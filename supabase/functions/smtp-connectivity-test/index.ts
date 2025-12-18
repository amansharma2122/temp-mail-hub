import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConnectivityTestRequest {
  host: string;
  port: number;
}

interface TestResult {
  success: boolean;
  dnsResolved: boolean;
  tcpConnected: boolean;
  error?: string;
  resolvedIp?: string;
  responseTime?: number;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { host, port }: ConnectivityTestRequest = await req.json();

    if (!host || !port) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          dnsResolved: false,
          tcpConnected: false,
          error: "Host and port are required" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[smtp-connectivity-test] Testing ${host}:${port}`);

    const result: TestResult = {
      success: false,
      dnsResolved: false,
      tcpConnected: false,
    };

    // Step 1: DNS Resolution
    try {
      console.log(`[smtp-connectivity-test] Resolving DNS for ${host}...`);
      const addresses = await Deno.resolveDns(host, "A");
      
      if (addresses && addresses.length > 0) {
        result.dnsResolved = true;
        result.resolvedIp = addresses[0];
        console.log(`[smtp-connectivity-test] DNS resolved: ${host} -> ${addresses[0]}`);
      } else {
        result.error = `DNS resolution returned no addresses for ${host}`;
        console.error(`[smtp-connectivity-test] ${result.error}`);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (dnsError: any) {
      result.error = `DNS resolution failed: ${dnsError.message}. Check that the hostname is correct and publicly resolvable.`;
      console.error(`[smtp-connectivity-test] DNS error: ${dnsError.message}`);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: TCP Connection Test
    try {
      console.log(`[smtp-connectivity-test] Testing TCP connection to ${host}:${port}...`);
      
      // Try to establish a TCP connection with timeout
      const conn = await Promise.race([
        Deno.connect({ hostname: host, port }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout (10s)")), 10000)
        )
      ]) as Deno.Conn;

      // Read initial SMTP banner (optional, shows server is responding)
      try {
        const buffer = new Uint8Array(512);
        const readPromise = conn.read(buffer);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        
        const bytesRead = await Promise.race([readPromise, timeoutPromise]);
        
        if (bytesRead && typeof bytesRead === 'number') {
          const banner = new TextDecoder().decode(buffer.subarray(0, bytesRead));
          console.log(`[smtp-connectivity-test] SMTP Banner: ${banner.trim()}`);
        }
      } catch (readError) {
        // Ignore read errors, connection itself was successful
        console.log(`[smtp-connectivity-test] Could not read banner, but connection succeeded`);
      }

      conn.close();
      
      result.tcpConnected = true;
      result.success = true;
      result.responseTime = Date.now() - startTime;
      
      console.log(`[smtp-connectivity-test] TCP connection successful in ${result.responseTime}ms`);

    } catch (tcpError: any) {
      let hint = "";
      if (tcpError.message.includes("timeout")) {
        hint = "The server did not respond in time. It may be blocked by a firewall.";
      } else if (tcpError.message.includes("refused")) {
        hint = "Connection was refused. The port may be incorrect or the service is not running.";
      } else if (tcpError.message.includes("reset")) {
        hint = "Connection was reset. The server may have rejected the connection.";
      }
      
      result.error = `TCP connection failed: ${tcpError.message}. ${hint}`;
      console.error(`[smtp-connectivity-test] TCP error: ${tcpError.message}`);
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    result.responseTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[smtp-connectivity-test] Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        dnsResolved: false,
        tcpConnected: false,
        error: `Unexpected error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
