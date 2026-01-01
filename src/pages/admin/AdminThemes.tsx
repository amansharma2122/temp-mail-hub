import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette, Check, Plus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTheme, Theme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { generateId } from "@/lib/storage";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AdminThemes = () => {
  const { theme, themes, setTheme, addCustomTheme } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newTheme, setNewTheme] = useState({
    name: "",
    primary: "175 80% 50%",
    accent: "280 70% 55%",
    background: "222 47% 5%",
    card: "222 47% 8%",
    isDark: true,
  });

  // Load saved themes from database
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const { data } = await api.admin.getThemes();
        if (data?.value && Array.isArray(data.value)) {
          // Themes are already loaded in context via ThemeContext
        }
      } catch (error) {
        console.error('Error loading themes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadThemes();
  }, []);

  const handleCreateTheme = async () => {
    if (!newTheme.name) {
      toast.error("Please enter a theme name");
      return;
    }

    setIsSaving(true);

    try {
      const customTheme: Theme = {
        id: `custom-${generateId()}`,
        name: newTheme.name,
        colors: {
          primary: newTheme.primary,
          accent: newTheme.accent,
          background: newTheme.background,
          card: newTheme.card,
        },
        isDark: newTheme.isDark,
      };

      addCustomTheme(customTheme);
      setTheme(customTheme.id);

      // Save to database
      const customThemes = themes.filter(t => t.id.startsWith('custom-'));
      await api.admin.saveThemes([...customThemes, customTheme]);

      setDialogOpen(false);
      setNewTheme({
        name: "",
        primary: "175 80% 50%",
        accent: "280 70% 55%",
        background: "222 47% 5%",
        card: "222 47% 8%",
        isDark: true,
      });
      toast.success("Custom theme created!");
    } catch (error: any) {
      console.error('Error saving theme:', error);
      toast.error(error.message || 'Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectTheme = async (themeId: string) => {
    setTheme(themeId);
    
    // Save selected theme preference
    try {
      await api.admin.saveSettings('selected_theme', themeId);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Theme Customization</h2>
          <p className="text-sm text-muted-foreground">
            Choose or create custom themes for your site
          </p>
        </div>
        <Button variant="default" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Theme
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((t, index) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => handleSelectTheme(t.id)}
            className={`p-4 cursor-pointer transition-all rounded-lg border bg-card ${
              theme.id === t.id ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/30'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg"
                  style={{ backgroundColor: `hsl(${t.colors.primary})` }}
                />
                <div>
                  <p className="font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.isDark ? 'Dark' : 'Light'} theme
                  </p>
                </div>
              </div>
              {theme.id === t.id && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>

            {/* Color Preview */}
            <div className="flex gap-2">
              <div 
                className="flex-1 h-8 rounded"
                style={{ backgroundColor: `hsl(${t.colors.background})` }}
              />
              <div 
                className="flex-1 h-8 rounded"
                style={{ backgroundColor: `hsl(${t.colors.card})` }}
              />
              <div 
                className="flex-1 h-8 rounded"
                style={{ backgroundColor: `hsl(${t.colors.primary})` }}
              />
              <div 
                className="flex-1 h-8 rounded"
                style={{ backgroundColor: `hsl(${t.colors.accent})` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Current Theme Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 rounded-lg border bg-card"
      >
        <h3 className="font-semibold text-foreground mb-4">Current Theme: {theme.name}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Primary</p>
            <div 
              className="h-16 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: `hsl(${theme.colors.primary})`, color: theme.isDark ? '#000' : '#fff' }}
            >
              {theme.colors.primary}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Accent</p>
            <div 
              className="h-16 rounded-lg flex items-center justify-center text-sm text-white"
              style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
            >
              {theme.colors.accent}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Background</p>
            <div 
              className="h-16 rounded-lg flex items-center justify-center text-sm border border-border"
              style={{ backgroundColor: `hsl(${theme.colors.background})`, color: theme.isDark ? '#fff' : '#000' }}
            >
              {theme.colors.background}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Card</p>
            <div 
              className="h-16 rounded-lg flex items-center justify-center text-sm border border-border"
              style={{ backgroundColor: `hsl(${theme.colors.card})`, color: theme.isDark ? '#fff' : '#000' }}
            >
              {theme.colors.card}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Create Theme Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Theme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Theme Name</label>
              <Input
                value={newTheme.name}
                onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                placeholder="My Custom Theme"
                className="bg-secondary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Primary Color (HSL)</label>
                <Input
                  value={newTheme.primary}
                  onChange={(e) => setNewTheme({ ...newTheme, primary: e.target.value })}
                  placeholder="175 80% 50%"
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Accent Color (HSL)</label>
                <Input
                  value={newTheme.accent}
                  onChange={(e) => setNewTheme({ ...newTheme, accent: e.target.value })}
                  placeholder="280 70% 55%"
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Background (HSL)</label>
                <Input
                  value={newTheme.background}
                  onChange={(e) => setNewTheme({ ...newTheme, background: e.target.value })}
                  placeholder="222 47% 5%"
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Card (HSL)</label>
                <Input
                  value={newTheme.card}
                  onChange={(e) => setNewTheme({ ...newTheme, card: e.target.value })}
                  placeholder="222 47% 8%"
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Enable dark mode styling</p>
              </div>
              <Switch
                checked={newTheme.isDark}
                onCheckedChange={(checked) => setNewTheme({ ...newTheme, isDark: checked })}
              />
            </div>

            {/* Preview */}
            <div>
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="flex gap-2">
                <div 
                  className="flex-1 h-8 rounded"
                  style={{ backgroundColor: `hsl(${newTheme.background})` }}
                />
                <div 
                  className="flex-1 h-8 rounded"
                  style={{ backgroundColor: `hsl(${newTheme.card})` }}
                />
                <div 
                  className="flex-1 h-8 rounded"
                  style={{ backgroundColor: `hsl(${newTheme.primary})` }}
                />
                <div 
                  className="flex-1 h-8 rounded"
                  style={{ backgroundColor: `hsl(${newTheme.accent})` }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTheme} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Theme
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminThemes;
