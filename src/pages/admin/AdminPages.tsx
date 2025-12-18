import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { storage, STORAGE_KEYS, generateId } from "@/lib/storage";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
}

const AdminPages = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    published: true,
  });

  useEffect(() => {
    const loadedPages = storage.get<Page[]>(STORAGE_KEYS.PAGES, []);
    setPages(loadedPages);
    setIsLoading(false);
  }, []);

  const resetForm = () => {
    setFormData({ title: "", slug: "", content: "", published: true });
    setEditingPage(null);
  };

  const openEditDialog = (page: Page) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      content: page.content,
      published: page.published,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      toast.error("Title and content are required");
      return;
    }

    const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, "-");
    
    if (editingPage) {
      const updated = pages.map(p => 
        p.id === editingPage.id ? { ...p, ...formData, slug } : p
      );
      setPages(updated);
      storage.set(STORAGE_KEYS.PAGES, updated);
      toast.success("Page updated");
    } else {
      const newPage: Page = {
        id: generateId(),
        ...formData,
        slug,
      };
      const updated = [newPage, ...pages];
      setPages(updated);
      storage.set(STORAGE_KEYS.PAGES, updated);
      toast.success("Page created");
    }

    setDialogOpen(false);
    resetForm();
  };

  const deletePage = (id: string) => {
    const updated = pages.filter(p => p.id !== id);
    setPages(updated);
    storage.set(STORAGE_KEYS.PAGES, updated);
    toast.success("Page deleted");
  };

  const togglePublished = (id: string) => {
    const updated = pages.map(p => 
      p.id === id ? { ...p, published: !p.published } : p
    );
    setPages(updated);
    storage.set(STORAGE_KEYS.PAGES, updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Page Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage static pages
          </p>
        </div>
        <Button variant="neon" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Page
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="glass-card p-8 text-center text-muted-foreground">Loading...</div>
        ) : pages.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No pages yet
          </div>
        ) : (
          pages.map((page, index) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{page.title}</h3>
                      <Badge variant={page.published ? "default" : "secondary"}>
                        {page.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePublished(page.id)}
                  >
                    {page.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(page)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deletePage(page.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit Page" : "New Page"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="auto-generated"
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="bg-secondary/50 min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSave}>
              {editingPage ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPages;
