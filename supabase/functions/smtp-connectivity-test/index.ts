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
  banner?: string;
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

    // Direct TCP connection test - this handles DNS internally and avoids
    // the issue where Deno.resolveDns appends internal domain suffixes
    try {
      console.log(`[smtp-connectivity-test] Attempting direct TCP connection to ${host}:${port}...`);
      
      // Use Deno.connect which handles DNS resolution internally without the suffix issue
      const conn = await Promise.race([
        Deno.connect({ hostname: host, port, transport: "tcp" }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout (15s)")), 15000)
        )
      ]) as Deno.TcpConn;

      // If we got here, DNS resolved and TCP connected
      result.dnsResolved = true;
      result.tcpConnected = true;

      // Try to read SMTP banner
      try {
        const buffer = new Uint8Array(512);
        const readPromise = conn.read(buffer);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        
        const bytesRead = await Promise.race([readPromise, timeoutPromise]);
        
        if (bytesRead && typeof bytesRead === 'number') {
          const banner = new TextDecoder().decode(buffer.subarray(0, bytesRead)).trim();
          result.banner = banner;
          console.log(`[smtp-connectivity-test] SMTP Banner: ${banner}`);
          
          // Check if it looks like a valid SMTP response
          if (banner.startsWith('220')) {
            console.log(`[smtp-connectivity-test] Valid SMTP 220 response received`);
          }
        }
      } catch (readError) {
        console.log(`[smtp-connectivity-test] Could not read banner, but connection succeeded`);
      }

      conn.close();
      
      result.success = true;
      result.responseTime = Date.now() - startTime;
      
      console.log(`[smtp-connectivity-test] Connection successful in ${result.responseTime}ms`);

    } catch (connError: any) {
      console.error(`[smtp-connectivity-test] Connection error: ${connError.message}`);
      
      let hint = "";
      const msg = connError.message.toLowerCase();
      
      // Determine the type of error
      if (msg.includes("timeout")) {
        hint = "The server did not respond in time. It may be blocked by a firewall or the port may be wrong.";
      } else if (msg.includes("refused") || msg.includes("connection refused")) {
        result.dnsResolved = true; // DNS worked if connection was refused
        hint = "Connection was refused. The port may be incorrect or the SMTP service is not running.";
      } else if (msg.includes("reset")) {
        result.dnsResolved = true;
        hint = "Connection was reset by the server.";
      } else if (msg.includes("no such host") || msg.includes("not known") || msg.includes("getaddrinfo")) {
        hint = `Could not resolve hostname '${host}'. Please verify the SMTP hostname is correct.`;
      } else if (msg.includes("network is unreachable")) {
        hint = "Network is unreachable. Check your network configuration.";
      } else {
        hint = "Check that the host and port are correct.";
      }
      
      result.error = `Connection failed: ${connError.message}. ${hint}`;
      
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
