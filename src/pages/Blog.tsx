import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Calendar, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const blogPosts = [
  {
    id: 1,
    title: "Why Temporary Emails Are Essential for Online Privacy",
    excerpt: "In an age of data breaches and spam, temporary emails provide a crucial layer of privacy protection...",
    author: "Alex Chen",
    date: "Dec 15, 2024",
    category: "Privacy",
    readTime: "5 min read",
  },
  {
    id: 2,
    title: "10 Ways to Use Disposable Emails Effectively",
    excerpt: "From testing to signing up for newsletters, discover the best use cases for temporary email addresses...",
    author: "Sarah Johnson",
    date: "Dec 12, 2024",
    category: "Tips",
    readTime: "7 min read",
  },
  {
    id: 3,
    title: "The Technology Behind Instant Email Generation",
    excerpt: "A deep dive into how services like TrashMails create and manage millions of disposable email addresses...",
    author: "Mike Rodriguez",
    date: "Dec 8, 2024",
    category: "Technology",
    readTime: "8 min read",
  },
  {
    id: 4,
    title: "Protecting Your Digital Identity in 2024",
    excerpt: "The latest trends in digital privacy and how you can safeguard your personal information online...",
    author: "Emma Wilson",
    date: "Dec 5, 2024",
    category: "Security",
    readTime: "6 min read",
  },
];

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium tracking-wider uppercase">Blog</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4 text-foreground">
              Privacy &
              <span className="gradient-text"> Insights</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Stay updated with the latest tips, news, and insights about online privacy and temporary emails.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 group cursor-pointer hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/20 text-primary">
                    {post.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{post.readTime}</span>
                </div>

                <h2 className="text-xl font-semibold mb-3 text-foreground group-hover:text-primary transition-colors">
                  {post.title}
                </h2>

                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {post.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {post.date}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.article>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <Button variant="glass" size="lg">
              Load More Articles
            </Button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
