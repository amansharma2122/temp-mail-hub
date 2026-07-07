import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  Save, 
  ExternalLink, 
  GripVertical,
  Settings,
  Eye,
  EyeOff,
  Globe,
  Palette,
  Maximize2,
  ArrowLeftRight,
  Smartphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import LucideIconPicker from "@/components/admin/LucideIconPicker";
import FriendlyWidgetAnalytics from "@/components/admin/FriendlyWidgetAnalytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FriendlyWebsite {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  icon_name?: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
  created_at: string;
  updated_at: string;
  attention_effect?: string | null;
  badge_enabled?: boolean | null;
  badge_text?: string | null;
  auto_open_override?: boolean | null;
  max_badge_per_day?: number | null;
}

interface WidgetSettings {
  enabled: boolean;
  visibleToPublic: boolean;
  visibleToLoggedIn: boolean;
  colorScheme: 'primary' | 'accent' | 'gradient' | 'glass';
  size: 'small' | 'medium' | 'large';
  position: 'left' | 'right';
  showOnMobile: boolean;
  animationType: 'slide' | 'fade' | 'bounce' | 'flip' | 'zoom';
  attentionEffect: 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring';
  buttonLabel: string;
  tooltipText: string;
  showBadge: boolean;
  badgeText: string;
  triggerIcon: string;
  autoOpenDelayMs: number;
  showLabelOnTrigger: boolean;
}

const defaultSettings: WidgetSettings = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  colorScheme: 'primary',
  size: 'medium',
  position: 'right',
  showOnMobile: true,
  animationType: 'slide',
  attentionEffect: 'pulse',
  buttonLabel: 'Partner Sites',
  tooltipText: 'Explore our partner sites',
  showBadge: true,
  badgeText: '',
  triggerIcon: 'Sparkles',
  autoOpenDelayMs: 0,
  showLabelOnTrigger: true,
};

const emptyForm = {
  name: '',
  url: '',
  icon_url: '',
  icon_name: '',
  description: '',
  open_in_new_tab: true,
  attention_effect: '' as '' | 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring',
  badge_enabled: true,
  badge_text: '',
  auto_open_override: 'inherit' as 'inherit' | 'force_on' | 'force_off',
  max_badge_per_day: 0,
};

function toAutoOpenValue(v: 'inherit' | 'force_on' | 'force_off'): boolean | null {
  return v === 'force_on' ? true : v === 'force_off' ? false : null;
}
function fromAutoOpenValue(v: boolean | null | undefined): 'inherit' | 'force_on' | 'force_off' {
  return v === true ? 'force_on' : v === false ? 'force_off' : 'inherit';
}

// Sortable Website Card Component
const SortableWebsiteCard = ({ 
  website, 
  onToggleActive, 
  onEdit, 
  onDelete 
}: { 
  website: FriendlyWebsite;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit: (website: FriendlyWebsite) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: website.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`${!website.is_active ? 'opacity-60' : ''} ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                {...attributes} 
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              >
                <GripVertical className="w-5 h-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Drag to reorder</p>
            </TooltipContent>
          </Tooltip>

          {website.icon_name && (LucideIcons as any)[website.icon_name] ? (
            (() => {
              const Icon = (LucideIcons as any)[website.icon_name!];
              return (
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              );
            })()
          ) : website.icon_url ? (
            <img 
              src={website.icon_url} 
              alt={website.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-semibold">
                {website.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{website.name}</h3>
            <a 
              href={website.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
            >
              {website.url}
              <ExternalLink className="w-3 h-3" />
            </a>
            {website.description && (
              <p className="text-xs text-muted-foreground truncate mt-1">{website.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={website.is_active}
                    onCheckedChange={(checked) => onToggleActive(website.id, checked)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{website.is_active ? 'Disable' : 'Enable'} this website</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(website)}
                >
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit website details</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(website.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete website</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminFriendlyWebsites = () => {
  const queryClient = useQueryClient();
  const [websites, setWebsites] = useState<FriendlyWebsite[]>([]);
  const [settings, setSettings] = useState<WidgetSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<FriendlyWebsite | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    icon_url: '',
    icon_name: '',
    description: '',
    open_in_new_tab: true,
    attention_effect: '' as '' | 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring',
    badge_enabled: true,
    badge_text: '',
    auto_open_override: 'inherit' as 'inherit' | 'force_on' | 'force_off',
    max_badge_per_day: 0,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch websites
      const { data: websitesData, error: websitesError } = await supabase
        .from('friendly_websites')
        .select('*')
        .order('display_order', { ascending: true });

      if (websitesError) throw websitesError;
      setWebsites(websitesData || []);

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'friendly_sites_widget')
        .maybeSingle();

      if (settingsData?.value) {
        setSettings({ ...defaultSettings, ...(settingsData.value as Partial<WidgetSettings>) });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Check if settings exist first
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'friendly_sites_widget')
        .maybeSingle();

      // Convert settings to JSON-compatible format
      const settingsJson = JSON.parse(JSON.stringify(settings));

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: settingsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'friendly_sites_widget');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert([{
            key: 'friendly_sites_widget',
            value: settingsJson,
            updated_at: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
      // Invalidate both the general app_settings and the specific widget query
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      queryClient.invalidateQueries({ queryKey: ['app_settings', 'friendly_sites_widget'] });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWebsite = async () => {
    if (!formData.name || !formData.url) {
      toast.error('Name and URL are required');
      return;
    }

    try {
      const maxOrder = Math.max(...websites.map(w => w.display_order), -1);
      
      const { error } = await supabase
        .from('friendly_websites')
        .insert({
          name: formData.name,
          url: formData.url,
          icon_url: formData.icon_url || null,
          icon_name: formData.icon_name || null,
          description: formData.description || null,
          open_in_new_tab: formData.open_in_new_tab,
          display_order: maxOrder + 1,
          attention_effect: formData.attention_effect || null,
          badge_enabled: formData.badge_enabled,
          badge_text: formData.badge_text || null,
          auto_open_override: toAutoOpenValue(formData.auto_open_override),
          max_badge_per_day: formData.max_badge_per_day,
        } as any);

      if (error) throw error;

      toast.success('Website added successfully');
      setAddDialogOpen(false);
      setFormData({ ...emptyForm });
      fetchData();
    } catch (error) {
      console.error('Error adding website:', error);
      toast.error('Failed to add website');
    }
  };

  const handleUpdateWebsite = async () => {
    if (!editingWebsite) return;

    try {
      const { error } = await supabase
        .from('friendly_websites')
        .update({
          name: formData.name,
          url: formData.url,
          icon_url: formData.icon_url || null,
          icon_name: formData.icon_name || null,
          description: formData.description || null,
          open_in_new_tab: formData.open_in_new_tab,
          attention_effect: formData.attention_effect || null,
          badge_enabled: formData.badge_enabled,
          badge_text: formData.badge_text || null,
          auto_open_override: toAutoOpenValue(formData.auto_open_override),
          max_badge_per_day: formData.max_badge_per_day,
        } as any)
        .eq('id', editingWebsite.id);

      if (error) throw error;

      toast.success('Website updated successfully');
      setEditingWebsite(null);
      setFormData({ ...emptyForm });
      fetchData();
    } catch (error) {
      console.error('Error updating website:', error);
      toast.error('Failed to update website');
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this website?')) return;

    try {
      const { error } = await supabase
        .from('friendly_websites')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Website deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting website:', error);
      toast.error('Failed to delete website');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('friendly_websites')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(isActive ? 'Website enabled' : 'Website disabled');
      fetchData();
    } catch (error) {
      console.error('Error toggling website:', error);
      toast.error('Failed to update website');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = websites.findIndex((w) => w.id === active.id);
      const newIndex = websites.findIndex((w) => w.id === over.id);

      const newWebsites = arrayMove(websites, oldIndex, newIndex);
      setWebsites(newWebsites);

      // Update display_order in database
      try {
        const updates = newWebsites.map((website, index) => ({
          id: website.id,
          display_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from('friendly_websites')
            .update({ display_order: update.display_order })
            .eq('id', update.id);
        }

        toast.success('Order updated successfully');
      } catch (error) {
        console.error('Error updating order:', error);
        toast.error('Failed to update order');
        fetchData(); // Revert on error
      }
    }
  };

  const openEditDialog = (website: FriendlyWebsite) => {
    setEditingWebsite(website);
    setFormData({
      name: website.name,
      url: website.url,
      icon_url: website.icon_url || '',
      icon_name: website.icon_name || '',
      description: website.description || '',
      open_in_new_tab: website.open_in_new_tab,
      attention_effect: (website.attention_effect ?? '') as typeof emptyForm.attention_effect,
      badge_enabled: website.badge_enabled ?? true,
      badge_text: website.badge_text ?? '',
      auto_open_override: fromAutoOpenValue(website.auto_open_override ?? null),
      max_badge_per_day: website.max_badge_per_day ?? 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Friendly Websites</h1>
          <p className="text-muted-foreground">Manage partner sites shown in the sidebar widget</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Website
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add a new friendly website link</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="websites">
        <TabsList>
          <TabsTrigger value="websites">
            <Globe className="w-4 h-4 mr-2" />
            Websites
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Widget Settings
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <Sparkles className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="websites" className="space-y-4 mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </CardContent>
            </Card>
          ) : websites.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No websites yet</h3>
                <p className="text-muted-foreground mb-4">Add your first friendly website to show in the sidebar</p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Website
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={websites.map(w => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {websites.map((website) => (
                    <SortableWebsiteCard
                      key={website.id}
                      website={website}
                      onToggleActive={handleToggleActive}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteWebsite}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Widget Settings</CardTitle>
              <CardDescription>Configure how the friendly websites sidebar appears</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Widget</Label>
                  <p className="text-sm text-muted-foreground">Show the sidebar widget on the homepage</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              {/* Visibility */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Visible to Public</Label>
                      <p className="text-xs text-muted-foreground">Show to non-logged-in users</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.visibleToPublic}
                    onCheckedChange={(checked) => setSettings({ ...settings, visibleToPublic: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Visible to Logged-in</Label>
                      <p className="text-xs text-muted-foreground">Show to authenticated users</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.visibleToLoggedIn}
                    onCheckedChange={(checked) => setSettings({ ...settings, visibleToLoggedIn: checked })}
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Color Scheme
                  </Label>
                  <Select
                    value={settings.colorScheme}
                    onValueChange={(value: WidgetSettings['colorScheme']) => 
                      setSettings({ ...settings, colorScheme: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="accent">Accent</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="glass">Glass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" />
                    Size
                  </Label>
                  <Select
                    value={settings.size}
                    onValueChange={(value: WidgetSettings['size']) => 
                      setSettings({ ...settings, size: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    Position
                  </Label>
                  <Select
                    value={settings.position}
                    onValueChange={(value: WidgetSettings['position']) => 
                      setSettings({ ...settings, position: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Animation Type</Label>
                  <Select
                    value={settings.animationType}
                    onValueChange={(value: WidgetSettings['animationType']) => 
                      setSettings({ ...settings, animationType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slide">Slide</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="flip">Flip</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Attention & branding */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Attention Effect
                  </Label>
                  <Select
                    value={settings.attentionEffect}
                    onValueChange={(v: WidgetSettings['attentionEffect']) =>
                      setSettings({ ...settings, attentionEffect: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="pulse">Pulse</SelectItem>
                      <SelectItem value="glow">Glow</SelectItem>
                      <SelectItem value="wiggle">Wiggle</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="ring">Ring</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Makes the widget more noticeable while closed.</p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> Trigger Icon
                  </Label>
                  <LucideIconPicker
                    value={settings.triggerIcon}
                    onChange={(name) => setSettings({ ...settings, triggerIcon: name })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Button Label</Label>
                  <Input
                    value={settings.buttonLabel}
                    onChange={(e) => setSettings({ ...settings, buttonLabel: e.target.value })}
                    placeholder="Partner Sites"
                    maxLength={40}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tooltip Text</Label>
                  <Input
                    value={settings.tooltipText}
                    onChange={(e) => setSettings({ ...settings, tooltipText: e.target.value })}
                    placeholder="Explore our partner sites"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Badge Text (blank = count)</Label>
                  <Input
                    value={settings.badgeText}
                    onChange={(e) => setSettings({ ...settings, badgeText: e.target.value })}
                    placeholder="New"
                    maxLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Auto-open Delay (ms, 0 = off)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    value={settings.autoOpenDelayMs}
                    onChange={(e) => setSettings({ ...settings, autoOpenDelayMs: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <p className="text-xs text-muted-foreground">Opens once per session after the delay.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Show Notification Badge</Label>
                    <p className="text-xs text-muted-foreground">Small badge on the trigger button</p>
                  </div>
                  <Switch
                    checked={settings.showBadge}
                    onCheckedChange={(v) => setSettings({ ...settings, showBadge: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Show Label on Trigger</Label>
                    <p className="text-xs text-muted-foreground">Vertical label next to the icon</p>
                  </div>
                  <Switch
                    checked={settings.showLabelOnTrigger}
                    onCheckedChange={(v) => setSettings({ ...settings, showLabelOnTrigger: v })}
                  />
                </div>
              </div>

              {/* Mobile */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label>Show on Mobile</Label>
                    <p className="text-xs text-muted-foreground">Display widget on mobile devices</p>
                  </div>
                </div>
                <Switch
                  checked={settings.showOnMobile}
                  onCheckedChange={(checked) => setSettings({ ...settings, showOnMobile: checked })}
                />
              </div>

              {/* Save Button */}
              <Button onClick={saveSettings} disabled={isSaving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Website Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Friendly Website</DialogTitle>
            <DialogDescription>
              Add a partner or related website to show in the sidebar widget
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Website name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon URL (optional)</Label>
              <Input
                placeholder="https://example.com/icon.png"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (from library, overrides URL)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <LucideIconPicker
                    value={formData.icon_name}
                    onChange={(name) => setFormData({ ...formData, icon_name: name })}
                  />
                </div>
                {formData.icon_name && (
                  <Button variant="ghost" size="sm" onClick={() => setFormData({ ...formData, icon_name: '' })}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of the website"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Open in new tab</Label>
              <Switch
                checked={formData.open_in_new_tab}
                onCheckedChange={(checked) => setFormData({ ...formData, open_in_new_tab: checked })}
              />
            </div>

            <div className="pt-2 border-t space-y-3">
              <p className="text-sm font-medium">Per-site notification rules</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Attention effect</Label>
                  <Select
                    value={formData.attention_effect || 'inherit'}
                    onValueChange={(v) => setFormData({ ...formData, attention_effect: (v === 'inherit' ? '' : v) as typeof formData.attention_effect })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit widget</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="pulse">Pulse</SelectItem>
                      <SelectItem value="glow">Glow</SelectItem>
                      <SelectItem value="wiggle">Wiggle</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="ring">Ring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Auto-open</Label>
                  <Select
                    value={formData.auto_open_override}
                    onValueChange={(v) => setFormData({ ...formData, auto_open_override: v as typeof formData.auto_open_override })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit widget</SelectItem>
                      <SelectItem value="force_on">Always auto-open</SelectItem>
                      <SelectItem value="force_off">Never auto-open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Badge text (blank = widget default)</Label>
                  <Input maxLength={12} value={formData.badge_text}
                    onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max badge displays / day (0 = ∞)</Label>
                  <Input type="number" min={0} max={100} value={formData.max_badge_per_day}
                    onChange={(e) => setFormData({ ...formData, max_badge_per_day: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show badge for this site</Label>
                <Switch checked={formData.badge_enabled}
                  onCheckedChange={(v) => setFormData({ ...formData, badge_enabled: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddWebsite}>Add Website</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Website Dialog */}
      <Dialog open={!!editingWebsite} onOpenChange={(open) => !open && setEditingWebsite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Website</DialogTitle>
            <DialogDescription>
              Update the website details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Website name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon URL (optional)</Label>
              <Input
                placeholder="https://example.com/icon.png"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (from library, overrides URL)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <LucideIconPicker
                    value={formData.icon_name}
                    onChange={(name) => setFormData({ ...formData, icon_name: name })}
                  />
                </div>
                {formData.icon_name && (
                  <Button variant="ghost" size="sm" onClick={() => setFormData({ ...formData, icon_name: '' })}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of the website"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Open in new tab</Label>
              <Switch
                checked={formData.open_in_new_tab}
                onCheckedChange={(checked) => setFormData({ ...formData, open_in_new_tab: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWebsite(null)}>Cancel</Button>
            <Button onClick={handleUpdateWebsite}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFriendlyWebsites;
