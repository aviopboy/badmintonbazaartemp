import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, Check, ChevronDown, CreditCard, Edit3, Heart,
  LayoutDashboard, Loader2, Menu, Minus, Package, Play, Plus, Search,
  ShieldCheck, ShoppingBag, Sparkles, Trash2, Truck, Upload, UserPlus, UserRound,
  X, Eye, EyeOff, RefreshCw, Video, Phone, Mail, Download, FileImage,
} from "lucide-react";
import "./index.css";
import logoImg from "@assets/image_1785068893314.png";
import qrImg from "@assets/image_1785068900913.png";
import { sendOrderEmail, sendStatusEmail } from "./lib/email";
import { createOrder as createSharedOrder, listOrders, updateOrder as updateSharedOrder, deleteOrder as deleteSharedOrder, listUsers as listApiUsers, createUser as createApiUser, patchUser as patchApiUser, deleteUser as deleteApiUser, listProducts as listApiProducts, createProduct as createApiProduct, updateProduct as updateApiProduct, deleteProduct as deleteApiProduct, getSetting, putSetting } from "@workspace/api-client-react";
import { useLocation, Router } from "wouter";

/* ─── Types ─────────────────────────────────────────────────── */
type Category =
  | "Rackets" | "Shoes" | "Shuttlecocks" | "Strings" | "Grips"
  | "Kit Bags" | "Apparel" | "Socks" | "Accessories"
  | "Wristbands" | "Injury Support" | "Training & Fitness"
  | "Court Equipment" | "Stringing Tools" | "Recovery & Nutrition";

type Product = {
  id: string; name: string; brand: string; category: Category;
  price: number; compareAt?: number; description: string;
  image: string; tags: string[]; featured?: boolean; badge?: string;
  showcase?: string; // URL to a showcase image or YouTube video (e.g. https://youtube.com/watch?v=...)
  availableSizes?: string[]; // e.g. ["UK 6","UK 7","UK 8"] for shoes or ["S","M","L","XL"] for apparel
  availableSpeeds?: string[]; // e.g. ["75","76","77","78"] for shuttlecocks
};
type CartLine = { productId: string; quantity: number; size?: string; power?: number; speed?: string };
type User = { id: string; name: string; email: string; password: string; admin: boolean; joined: string };
type OrderStatus = "pending" | "approved" | "rejected";
type Order = {
  id: string;
  userId: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  additionalContact: string;
  paymentReference: string;
  paymentProof: string;
  status: OrderStatus;
  reviewMessage: string;
  createdAt: string;
  items: { name: string; brand: string; price: number; quantity: number; size?: string; power?: number; speed?: string }[];
  total: number;
};
type Toast = { id: number; message: string; error?: boolean };
type View = "store" | "account" | "admin";
type Modal = "auth" | "product" | "cart" | "checkout" | "add-user" | null;

/* ─── Category metadata ──────────────────────────────────────── */
const ALL_CATEGORIES: Category[] = [
  "Rackets", "Shoes", "Shuttlecocks", "Strings", "Grips",
  "Kit Bags", "Apparel", "Socks", "Accessories", "Wristbands",
  "Injury Support", "Training & Fitness", "Court Equipment",
  "Stringing Tools", "Recovery & Nutrition",
];

/* ─── SVG Placeholder fallbacks ─────────────────────────────── */
const svgArt = (kind: "racket" | "shoe" | "shuttle" | "bag" | "apparel" | "accessory", color: string, accent = "#b9e532") => {
  const bodies: Record<string, string> = {
    racket: `<g transform="rotate(-10 220 220)"><ellipse cx="220" cy="111" rx="82" ry="104" fill="${color}" stroke="#191b18" stroke-width="7"/><ellipse cx="220" cy="111" rx="64" ry="83" fill="none" stroke="${accent}" stroke-width="3"/><path d="M173 37L267 185M267 37L173 185M149 111h142M220 9v204" stroke="#191b18" stroke-width="2" opacity=".45"/><path d="M206 202h28l18 184-30 10-30-10z" fill="${accent}" stroke="#191b18" stroke-width="7"/><path d="M190 374l45 14-10 35-48-15z" fill="#191b18"/></g>`,
    shoe: `<g transform="rotate(-5 220 240)"><path d="M100 302c38-52 67-104 74-175l8-79c31-18 81-15 109 9l-7 83c-4 47 28 73 72 106 15 12 16 31-2 42-51 31-148 29-230 26-25-1-37-1-24-12z" fill="${color}" stroke="#191b18" stroke-width="7"/><path d="M185 81c29 25 61 35 99 31M177 125c32 26 67 35 104 32" stroke="${accent}" stroke-width="10" fill="none"/><path d="M96 302c73 15 137 8 230-14 33 11 44 27 27 43-57 50-192 30-272 18-21-4-9-28 15-47z" fill="#191b18"/></g>`,
    shuttle: `<g><ellipse cx="220" cy="300" rx="40" ry="30" fill="${color}" stroke="#191b18" stroke-width="5"/><path d="M220 270 L180 100 M220 270 L220 80 M220 270 L260 100 M220 270 L250 120 M220 270 L190 120" stroke="${color}" stroke-width="4" opacity=".8"/><ellipse cx="220" cy="95" rx="70" ry="25" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/></g>`,
    bag: `<g><rect x="100" y="130" width="240" height="180" rx="20" fill="${color}" stroke="#191b18" stroke-width="7"/><path d="M160 130 v-30 a60 60 0 0 1 120 0 v30" fill="none" stroke="#191b18" stroke-width="6"/><rect x="115" y="195" width="210" height="2" fill="${accent}" opacity=".5"/><rect x="130" y="155" width="80" height="60" rx="5" fill="#191b18" opacity=".3"/></g>`,
    apparel: `<g><path d="M140 100 L100 160 L150 180 L150 330 L290 330 L290 180 L340 160 L300 100 L260 130 C250 150 190 150 180 130 Z" fill="${color}" stroke="#191b18" stroke-width="7"/><path d="M180 130 C190 150 250 150 260 130" stroke="${accent}" stroke-width="4" fill="none"/></g>`,
    accessory: `<g><rect x="130" y="140" width="180" height="160" rx="10" fill="${color}" stroke="#191b18" stroke-width="6"/><circle cx="220" cy="220" r="40" fill="${accent}" opacity=".4"/><circle cx="220" cy="220" r="20" fill="#191b18" opacity=".3"/></g>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 440"><rect width="440" height="440" fill="#1a1c17"/><circle cx="366" cy="72" r="54" fill="${accent}" opacity=".08"/><circle cx="67" cy="361" r="92" fill="#2a2d26" opacity=".7"/>${bodies[kind] ?? bodies.accessory}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

/* ─── Seed products ──────────────────────────────────────────── */
const Y = "https://www.yonex.com/media/catalog/product";
const V = "https://www.victorsport.com/media/catalog/product";

const officialRacketImages: Record<string, string[]> = {
  "astrox 100 zz": [
    "https://www.yonex.com/us/media/catalog/product/a/s/astrox100zz_kurenai.png?quality=80&fit=bounds&height=819&width=600&canvas=600:819",
    "https://www.yonex.com/media/catalog/product/a/s/astrox100zz_kurenai.png?quality=80&bg-color=248,248,248,0.75&fit=bounds&height=819&width=600&canvas=600:819",
  ],
  "nanoflare 1000 z": [
    "https://www.yonex.com/us/media/catalog/product/n/a/nanoflare_1000_z.png?quality=80&fit=bounds&height=819&width=600&canvas=600:819",
    "https://us.yonex.com/cdn/shop/files/NANOFLARE_1000_product.jpg?v=1760045976&width=1445",
  ],
  "astrox 99": [
    "https://us.yonex.com/cdn/shop/files/ax99-pro_whitetiger.png?v=1756957305&width=1445",
    "https://www.yonex.com/media/catalog/product/a/l/all_3ax99-p_530-1.jpg?quality=80&fit=bounds&height=819&width=600",
  ],
  "axforce cannon": [
    "https://in.lining.studio/cdn/shop/files/1_1_6f11ebfee3_5bb87cd7-879d-4214-a230-899cf265d399.jpg?v=1749898570&width=1200",
    "https://in.lining.studio/cdn/shop/files/1_2_1e27243f21_3b97da4c-f81b-4605-9ca9-ad477b4cfe36.jpg?v=1749898570&width=1200",
    "https://in.lining.studio/cdn/shop/files/1_3_c06ad9f076_4f5704e8-e9b9-43da-b687-f2e399adb43e.jpg?v=1749898570&width=1200",
  ],
  "axforce 100": [
    "https://in.lining.studio/cdn/shop/files/1_379e72d6ad_7d5cd489-e18b-48c5-966b-d7c29b941212.jpg?v=1749897618&width=1200",
    "https://in.lining.studio/cdn/shop/files/2_8230d822ad_3f2f63d5-1c74-41ad-b30b-924d09dd6aa8.jpg?v=1749897618&width=1200",
    "https://in.lining.studio/cdn/shop/files/3_039601b024_650ee032-5dd1-4746-af9d-69a8d82bd9fd.jpg?v=1749897617&width=1200",
  ],
};

const initialProducts: Product[] = [];

const seedUsers: User[] = [
  { id: "u-admin", name: "Bazaar Admin", email: "avilit9@gmail.com", password: "admin", admin: true, joined: "Founder account" },
];

/* ─── Utilities ──────────────────────────────────────────────── */
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const storage = {
  get<T>(key: string, fallback: T): T {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
  },
  set(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ } },
};

function mergeProducts(localProducts: Product[], sharedProducts: Product[]): Product[] {
  const merged = new Map<string, Product>();
  const add = (product: Product) => {
    if (!product?.id) return;
    merged.set(product.id, {
      ...product,
      tags: Array.isArray(product.tags) ? product.tags : [],
      availableSizes: Array.isArray(product.availableSizes) ? product.availableSizes : [],
      availableSpeeds: Array.isArray(product.availableSpeeds) ? product.availableSpeeds : [],
    });
  };

  localProducts.forEach(add);
  sharedProducts.forEach(add);
  return [...merged.values()];
}

function mergeUsers(localUsers: User[], sharedUsers: User[]): User[] {
  const merged = new Map<string, User>();
  const add = (user: User) => {
    if (!user?.id || !user.email) return;
    merged.set(user.email.trim().toLowerCase(), user);
  };

  localUsers.forEach(add);
  sharedUsers.forEach(add);
  return [...merged.values()].sort((a, b) => (a.admin === b.admin ? 0 : a.admin ? -1 : 1));
}

function isYouTubeUrl(url: string) {
  return /youtu(be\.com|\.be)/i.test(url);
}
function youtubeEmbedUrl(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0` : null;
}

/* ─── Category → SVG kind ────────────────────────────────────── */
function categoryToSvgKind(category: Category): "racket" | "shoe" | "shuttle" | "bag" | "apparel" | "accessory" {
  if (category === "Rackets" || category === "Strings" || category === "Grips" || category === "Stringing Tools") return "racket";
  if (category === "Shoes" || category === "Socks") return "shoe";
  if (category === "Shuttlecocks") return "shuttle";
  if (category === "Kit Bags") return "bag";
  if (category === "Apparel") return "apparel";
  return "accessory";
}

/* ─── Image fetch helpers ────────────────────────────────────── */
function buildImageCandidates(name: string, category: Category): { label: string; url: string }[] {
  const key = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const images = officialRacketImages[key];
  if (category === "Rackets" && images) {
    return images.map((url, index) => ({ label: `Official image ${index + 1}`, url }));
  }
  return [];
}

/* ════════════════════════════════════════════════════════════════
   ROOT APP COMPONENT
══════════════════════════════════════════════════════════════════ */
function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = storage.get<Product[]>("bb-products-v4", initialProducts);
    const legacyImages: Record<string, string> = {
      "p-astrox-100-zz": `${Y}/a/x/ax100zz-366.jpg`,
      "p-nanoflare-1000-z": `${Y}/n/f/nf1000z-366.jpg`,
      "p-astrox-99": `${Y}/a/x/ax99-366.jpg`,
    };
    return saved.map((product) => {
      const official = officialRacketImages[product.name.toLowerCase()];
      return official && (product.image === legacyImages[product.id] || product.image.startsWith("data:image/"))
        ? { ...product, image: official[0], showcase: product.showcase ?? official[1] }
        : product;
    });
  });
  const [users, setUsers] = useState<User[]>(() => {
    const saved = storage.get<User[]>("bb-users-v2", seedUsers);
    return saved.some((u) => u.id === "u-admin") ? saved : [seedUsers[0], ...saved];
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.get<User | null>("bb-current-user", null));
  const [cart, setCart] = useState<CartLine[]>(() => storage.get("bb-cart", []));
  const [wishlist, setWishlist] = useState<string[]>(() => storage.get("bb-wishlist", []));
  const [location, setLocation] = useLocation();
  const [view, setViewState] = useState<View>(() => {
    if (location.startsWith("/admin")) return "admin";
    if (location.startsWith("/account")) return "account";
    return "store";
  });
  const setView = useCallback((v: View) => {
    setViewState(v);
    if (v === "admin") setLocation("/admin/orders");
    else if (v === "account") setLocation("/account");
    else setLocation("/");
  }, [setLocation]);
  // Sync browser back / forward to view state
  useEffect(() => {
    if (location.startsWith("/admin") && view !== "admin") setViewState("admin");
    else if (location.startsWith("/account") && view !== "account") setViewState("account");
    else if (location === "/" && view !== "store") setViewState("store");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<"All" | Category>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [heroBackground, setHeroBackground] = useState(() => storage.get("bb-hero-bg", ""));
  const [founderEmail, setFounderEmail] = useState("ashishkushwah8080@gmail.com");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const syncOrdersFnRef = useRef<(() => Promise<void>) | null>(null);
  const ordersRefreshingRef = useRef(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const productsSyncedRef = useRef(false);
  const localProductsAtStartupRef = useRef(products);
  const localUsersAtStartupRef = useRef(users);

  const clearCart = () => setCart([]);

  useEffect(() => storage.set("bb-products-v4", products), [products]);
  useEffect(() => storage.set("bb-users-v2", users), [users]);
  useEffect(() => storage.set("bb-current-user", currentUser), [currentUser]);
  useEffect(() => storage.set("bb-cart", cart), [cart]);
  useEffect(() => storage.set("bb-wishlist", wishlist), [wishlist]);
  useEffect(() => storage.set("bb-hero-bg", heroBackground), [heroBackground]);
  useEffect(() => storage.set("bb-founder-email", founderEmail), [founderEmail]);
  useEffect(() => {
    document.title = "Badminton Bazaar — Play More. Win More.";
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setOrdersLoaded(false);
      return;
    }

    let cancelled = false;
    const syncOrders = async () => {
      try {
        const localOrders = storage.get<Order[]>("bb-orders-v1", []);
        if (localOrders.length > 0) {
          await Promise.all(localOrders.map((order) => createSharedOrder(order)));
          storage.set("bb-orders-v1", []); // clear after successful upload so they don't re-upload on every login
        }
        const sharedOrders = await listOrders(currentUser.admin ? undefined : { email: currentUser.email });
        if (!cancelled) {
          setOrders(sharedOrders);
          setOrdersLoaded(true);
        }
      } catch (error) {
        console.error("[Badminton Bazaar] Shared order sync failed:", error);
        if (!cancelled) setOrdersLoaded(true);
      }
    };
    syncOrdersFnRef.current = syncOrders;

    void syncOrders();
    const refreshTimer = window.setInterval(() => { void syncOrders(); }, 15_000);
    return () => {
      cancelled = true;
      syncOrdersFnRef.current = null;
      window.clearInterval(refreshTimer);
    };
  }, [currentUser]);

  const refreshOrders = useCallback(async () => {
    if (!syncOrdersFnRef.current || ordersRefreshingRef.current) return;
    ordersRefreshingRef.current = true;
    setOrdersRefreshing(true);
    try {
      await syncOrdersFnRef.current();
    } finally {
      ordersRefreshingRef.current = false;
      setOrdersRefreshing(false);
    }
  }, []);

  // ── All visitors: merge the shared catalog with local fallback data ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiProducts = await listApiProducts();
        if (!cancelled) {
          setProducts((localProducts) => mergeProducts(localProducts, apiProducts as Product[]));
        }
      } catch {
        // API unavailable — keep localStorage products as fallback
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Admin: non-destructive recovery of local products → shared DB ──
  useEffect(() => {
    if (!currentUser?.admin || productsSyncedRef.current) return;
    productsSyncedRef.current = true;
    (async () => {
      try {
        const apiProducts = await listApiProducts();
        const localProds = localProductsAtStartupRef.current;
        const sharedIds = new Set(apiProducts.map((product) => product.id));
        const missingLocalProducts = localProds.filter((product) => !sharedIds.has(product.id));

        if (missingLocalProducts.length > 0) {
          await Promise.allSettled(
            missingLocalProducts.map((product) =>
              createApiProduct({
                ...product,
                tags: product.tags ?? [],
                featured: product.featured ?? false,
              }),
            ),
          );
        }

        const refreshed = await listApiProducts();
        setProducts((currentProducts) => mergeProducts(currentProducts, refreshed as Product[]));
        if (missingLocalProducts.length > 0) toast("Local products recovered into the shared catalog.");
      } catch {
        productsSyncedRef.current = false;
        // ignore — local products stay visible
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.admin]);

  // ── All visitors: load users so accounts work across devices ──
  useEffect(() => {
    let cancelled = false;
    const syncUsers = async () => {
      try {
        const apiUsers = await listApiUsers();
        if (!cancelled) setUsers((localUsers) => mergeUsers(localUsers, apiUsers as User[]));
      } catch {
        // API unavailable — keep local users as fallback
      }
    };
    void syncUsers();
    return () => { cancelled = true; };
  }, []);

  // ── Admin: non-destructive recovery of local users → shared DB ──
  useEffect(() => {
    if (!currentUser?.admin) return;
    let cancelled = false;
    const syncUsers = async () => {
      try {
        const localUsers = localUsersAtStartupRef.current;
        if (localUsers.length > 0) {
          await Promise.allSettled(localUsers.map((user) => createApiUser(user)));
        }

        const apiUsers = await listApiUsers();
        if (!cancelled) {
          setUsers((localUsersNow) => mergeUsers(localUsersNow, apiUsers as User[]));
        }
      } catch {
        // fail silently — local users remain visible
      }
    };
    void syncUsers();
    const t = window.setInterval(() => { void syncUsers(); }, 30_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [currentUser?.admin]);

  const toast = (message: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, error }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3400);
  };

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cart.reduce((s, l) => s + (products.find((p) => p.id === l.productId)?.price ?? 0) * l.quantity, 0);

  const filteredProducts = useMemo(() => products
    .filter((p) => category === "All" || p.category === category)
    .filter((p) => `${p.name} ${p.brand} ${p.category} ${p.tags.join(" ")} ${p.badge ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : Number(Boolean(b.featured)) - Number(Boolean(a.featured))),
    [products, category, query, sort]);

  const openProduct = (p: Product) => { setSelectedProduct(p); setModal("product"); };
  const addToCart = (id: string, qty = 1, size?: string, power?: number, speed?: string) => {
    setCart((lines) => {
      const key = `${id}:${size ?? ""}:${power ?? ""}:${speed ?? ""}`;
      const ex = lines.find((l) => `${l.productId}:${l.size ?? ""}:${l.power ?? ""}:${l.speed ?? ""}` === key);
      return ex
        ? lines.map((l) => `${l.productId}:${l.size ?? ""}:${l.power ?? ""}:${l.speed ?? ""}` === key ? { ...l, quantity: l.quantity + qty } : l)
        : [...lines, { productId: id, quantity: qty, size, power, speed }];
    });
    toast("Added to your bag ✓");
  };
  const updateQty = (key: string, delta: number) => setCart((lines) => lines.map((l) => `${l.productId}:${l.size ?? ""}:${l.power ?? ""}:${l.speed ?? ""}` === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l).filter((l) => l.quantity > 0));
  const toggleWishlist = (id: string) => setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const requireAuth = () => { if (!currentUser) { setAuthMode("login"); setAuthError(""); setModal("auth"); return false; } return true; };
  const signOut = () => { setCurrentUser(null); setView("store"); toast("Signed out."); };

  const onAuth = (email: string, password: string, name: string) => {
    if (authMode === "login") {
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) { setAuthError("Incorrect email or password."); return; }
      setCurrentUser(user); setModal(null); setAuthError("");
      toast(`Welcome back, ${user.name.split(" ")[0]}!`);
      // Sync this user to DB in case they registered before the API was available
      createApiUser(user).catch(() => {});
    } else {
      if (!name.trim()) { setAuthError("Please enter your name."); return; }
      if (!email.includes("@")) { setAuthError("Please enter a valid email address."); return; }
      if (password.length < 4) { setAuthError("Password must be at least 4 characters."); return; }
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) { setAuthError("An account with this email already exists."); return; }
      const user: User = { id: `u-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), password, admin: false, joined: new Date().toLocaleDateString("en-IN") };
      setUsers((prev) => [...prev, user]); setCurrentUser(user); setModal(null); setAuthError("");
      toast(`Welcome, ${user.name.split(" ")[0]}!`);
      // Sync new registration to shared DB so admin can see all users across devices
      createApiUser(user).catch(() => {});
    }
  };


  const updateUser = async (updated: User) => {
    const previous = users.find((user) => user.id === updated.id) ?? currentUser;
    setCurrentUser(updated);
    setUsers((prev) => prev.map((user) => user.id === updated.id ? updated : user));

    try {
      const saved = await patchApiUser(updated.id, {
        name: updated.name,
        email: updated.email,
        password: updated.password,
      });
      const savedUser = saved as User;
      setCurrentUser((current) => current?.id === savedUser.id ? savedUser : current);
      setUsers((prev) => prev.map((user) => user.id === savedUser.id ? savedUser : user));
    } catch {
      if (previous) {
        setCurrentUser(previous);
        setUsers((prev) => prev.map((user) => user.id === previous.id ? previous : user));
      }
      toast("Could not save your account changes to the shared database.", true);
    }
  };

  const saveProduct = async (p: Product) => {
    const isUpdate = products.some((x) => x.id === p.id);
    setProducts((prev) => isUpdate ? prev.map((x) => x.id === p.id ? p : x) : [...prev, p]);
    setEditingProduct(null);
    toast(isUpdate ? "Product updated." : "Product added to catalog.");
    try {
      if (isUpdate) await updateApiProduct(p.id, { ...p, tags: p.tags ?? [], featured: p.featured ?? false });
      else await createApiProduct({ ...p, tags: p.tags ?? [], featured: p.featured ?? false });
    } catch {
      toast("Saved locally — failed to sync to shared catalog. Check your connection.", true);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Remove this product from the catalog? This cannot be undone.")) return;
    try {
      // Only hide the product after the explicit server-side deletion succeeds.
      await deleteApiProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast("Product removed.");
    } catch {
      toast("Could not delete the product. The existing product was kept.", true);
    }
  };

  const toggleUserAdmin = async (user: User) => {
    try {
      const updated = await patchApiUser(user.id, { admin: !user.admin }) as User;
      setUsers((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast(updated.admin ? "Admin granted." : "Admin revoked.");
    } catch {
      toast("Could not update this user. The existing user was kept unchanged.", true);
    }
  };

  const deleteUser = async (user: User) => {
    if (!window.confirm(`Delete "${user.name}"? This cannot be undone.`)) return;
    try {
      // A failed request must never make an existing user disappear locally.
      await deleteApiUser(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast("User removed.");
    } catch {
      toast("Could not delete this user. The existing user was kept.", true);
    }
  };

  const submitOrder = async (details: Omit<Order, "id" | "userId" | "status" | "reviewMessage" | "createdAt" | "items" | "total">) => {
    const items = cart.flatMap((line) => {
      const product = products.find((p) => p.id === line.productId);
      return product ? [{ name: product.name, brand: product.brand, price: product.price, quantity: line.quantity, size: line.size, power: line.power, speed: line.speed }] : [];
    });
    const order: Order = {
      ...details,
      id: `BB-${Date.now().toString(36).toUpperCase()}`,
      userId: currentUser?.id ?? "",
      status: "pending",
      reviewMessage: "",
      createdAt: new Date().toISOString(),
      items,
      total: cartTotal,
    };
    // Add to local state and clear cart immediately — don't wait for API
    setOrders((prev) => [order, ...prev.filter((existing) => existing.id !== order.id)]);
    clearCart();
    // Back up to localStorage so the order survives a page refresh and retries
    // on next login if the API save fails (the syncOrders effect will pick it up)
    const backup = storage.get<Order[]>("bb-orders-v1", []);
    storage.set("bb-orders-v1", [order, ...backup.filter((o) => o.id !== order.id)]);
    // Save to shared database in the background
    createSharedOrder(order)
      .then((sharedOrder: Order) => {
        setOrders((prev) => prev.map((o) => o.id === sharedOrder.id ? sharedOrder : o));
        // Confirmed in DB — remove from localStorage backup
        const current = storage.get<Order[]>("bb-orders-v1", []);
        storage.set("bb-orders-v1", current.filter((o) => o.id !== sharedOrder.id));
      })
      .catch((_err: unknown) => {
        console.warn("[Badminton Bazaar] Background order sync failed — will retry on next login:", _err);
      });
    toast(`Payment proof saved. Invoice ${order.id} is pending review.`);
    return order;
  };

  const updateOrder = async (id: string, status: OrderStatus, reviewMessage: string) => {
    try {
      const updated = await updateSharedOrder(id, { status, reviewMessage });
      setOrders((prev) => prev.map((order) => order.id === id ? updated : order));
      return updated;
    } catch (err) {
      console.error("[Badminton Bazaar] updateOrder failed:", err);
      throw err;
    }
  };

  const deleteOrder = async (id: string) => {
    await deleteSharedOrder(id);
    setOrders((prev) => prev.filter((order) => order.id !== id));
  };

  return (
    <div className="app-shell">
      <TopNav currentUser={currentUser} cartCount={cartCount} query={query}
        setQuery={(q) => { setQuery(q); setView("store"); }} setModal={setModal}
        setView={setView} view={view} setCategory={setCategory}
        setAuthMode={setAuthMode} setAuthError={setAuthError} />
      <Ticker />

      {view === "store" && (
        <Storefront products={filteredProducts} allProducts={products} category={category}
          setCategory={setCategory} sort={sort} setSort={setSort} query={query}
          openProduct={openProduct} addToCart={addToCart} wishlist={wishlist}
          toggleWishlist={toggleWishlist} heroBackground={heroBackground} />
      )}
      {view === "account" && currentUser && (
          <Account user={currentUser} orders={orders.filter((order) => order.userId === currentUser.id || order.email.toLowerCase() === currentUser.email.toLowerCase())} updateUser={updateUser} signOut={signOut} toast={toast} ordersLoaded={ordersLoaded} />
      )}
      {view === "account" && !currentUser && (
        <div className="gate-screen">
          <div className="gate-inner">
            <UserRound size={40} />
            <h2>Sign in to your account</h2>
            <p>Create an account or sign in to track your orders and manage preferences.</p>
            <button className="btn-primary" onClick={() => { setAuthMode("login"); setModal("auth"); }}>Sign In</button>
            <button className="btn-ghost" onClick={() => { setAuthMode("register"); setModal("auth"); }}>Create Account</button>
          </div>
        </div>
      )}
      {view === "admin" && currentUser?.admin && (
        <Admin products={products} users={users}
          toggleUserAdmin={toggleUserAdmin} deleteUser={deleteUser}
          heroBackground={heroBackground} setHeroBackground={setHeroBackground}
          orders={orders} updateOrder={updateOrder} deleteOrder={deleteOrder}
          toast={toast} modal={modal} setModal={setModal}
          editingProduct={editingProduct} setEditingProduct={setEditingProduct}
          saveProduct={saveProduct} deleteProduct={deleteProduct}
          refreshOrders={refreshOrders} ordersRefreshing={ordersRefreshing} />
      )}
      {view === "admin" && !currentUser?.admin && (
        <div className="gate-screen">
          <div className="gate-inner">
            <ShieldCheck size={40} /><h2>Admin access required</h2>
            <p>Sign in with an admin account to access the control panel.</p>
            <button className="btn-primary" onClick={() => setView("store")}>Back to Store</button>
          </div>
        </div>
      )}

      <SiteFooter setView={setView} setCategory={setCategory} />

      <AnimatePresence>
        {modal === "product" && selectedProduct && (
          <ProductModal key="product-modal" product={selectedProduct} close={() => setModal(null)} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "cart" && (
          <CartDrawer key="cart-drawer" cart={cart} products={products} close={() => setModal(null)} updateQty={updateQty} openProduct={openProduct} total={cartTotal} requireAuth={requireAuth} setModal={setModal} toast={toast} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === "auth" && (
          <AuthModal key="auth-modal" mode={authMode} setMode={(m) => { setAuthMode(m); setAuthError(""); }} close={() => setModal(null)} submit={onAuth} error={authError} />
        )}
      </AnimatePresence>
      {modal === "checkout" && (
        <CheckoutModal
          close={() => setModal(null)}
          total={cartTotal}
          user={currentUser}
          items={cart.flatMap((line) => {
            const product = products.find((p) => p.id === line.productId);
            return product ? [{ name: product.name, quantity: line.quantity, price: product.price, size: line.size, power: line.power, speed: line.speed }] : [];
          })}
          founderEmail={founderEmail}
          submitOrder={submitOrder}
        />
      )}
      {modal === "add-user" && currentUser?.admin && (
        <AddUserModal close={() => setModal(null)} users={users} setUsers={setUsers} toast={toast} />
      )}
      {editingProduct && view === "admin" && (
        <ProductEditor product={editingProduct} close={() => setEditingProduct(null)} save={saveProduct} />
      )}

      <a
        className="whatsapp-fab"
        href="https://wa.me/919104901959"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg className="whatsapp-fab-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.524 5.847L.057 23.664a.5.5 0 0 0 .612.612l5.817-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.9a9.878 9.878 0 0 1-5.031-1.371l-.361-.214-3.741.981.999-3.648-.235-.374A9.855 9.855 0 0 1 2.1 12C2.1 6.533 6.533 2.1 12 2.1S21.9 6.533 21.9 12 17.467 21.9 12 21.9z"/>
        </svg>
        <span>Need Help?</span>
      </a>

      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.error ? "error" : ""}`}
              initial={{ opacity: 0, y: 20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TOP NAV
══════════════════════════════════════════════════════════════════ */
const MOBILE_NAV_CATS: Category[] = [
  "Rackets", "Shoes", "Shuttlecocks", "Strings", "Grips",
  "Kit Bags", "Apparel", "Socks", "Accessories", "Wristbands",
  "Injury Support", "Training & Fitness", "Court Equipment",
];

function TopNav({ currentUser, cartCount, query, setQuery, setModal, setView, view, setCategory, setAuthMode, setAuthError }: {
  currentUser: User | null; cartCount: number; query: string; setQuery: (v: string) => void;
  setModal: (v: Modal) => void; setView: (v: View) => void; view: View;
  setCategory: (v: "All" | Category) => void; setAuthMode: (v: "login" | "register") => void;
  setAuthError: (v: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="site-header">
      <div className="header-top">
        <span>Free delivery across India on orders above ₹2,500</span>
        <div className="header-top-links">
          <button onClick={() => setView("account")}>My Account</button>
        </div>
      </div>
      <nav className="nav-main">
        <div className="nav-inner">
          <button className="brand-btn" onClick={() => { setView("store"); setCategory("All"); closeMobileMenu(); }} data-testid="button-home">
            <img src={logoImg} alt="Badminton Bazaar" className="brand-logo-img" />
            <div className="brand-text">
              <span className="brand-name">Badminton Bazaar</span>
              <span className="brand-tagline">Play More. Win More.</span>
            </div>
          </button>

          <div className="nav-links">
            {(["Rackets", "Shoes", "Shuttlecocks", "Strings", "Grips", "Kit Bags", "Apparel"] as Category[]).map((cat) => (
              <button key={cat} className="nav-link" onClick={() => { setView("store"); setCategory(cat); }} data-testid={`button-nav-${cat.toLowerCase().replace(" ", "-")}`}>{cat}</button>
            ))}
            {currentUser?.admin && (
              <button className={`nav-link ${view === "admin" ? "active" : ""}`} onClick={() => setView("admin")} data-testid="button-open-admin">
                <LayoutDashboard size={14} style={{ verticalAlign: "middle", marginRight: 3 }} />Admin
              </button>
            )}
          </div>

          <div className="nav-actions">
            <div className="nav-search-wrap">
              <button className="icon-btn" onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => inputRef.current?.focus(), 50); }} title="Search">
                <Search size={20} />
              </button>
              {searchOpen && (
                <div className="nav-search-dropdown">
                  <Search size={16} />
                  <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rackets, shoes, brands…" data-testid="input-search-products" autoFocus />
                  <button onClick={() => { setSearchOpen(false); setQuery(""); }}><X size={15} /></button>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => { if (currentUser) setView("account"); else { setAuthMode("login"); setAuthError(""); setModal("auth"); } }} title={currentUser ? "Account" : "Sign in"} data-testid="button-open-account">
              <UserRound size={20} />
              {currentUser && <span className="nav-user-dot" />}
            </button>
            <button className="icon-btn cart-btn" onClick={() => setModal("cart")} title="Cart" data-testid="button-open-cart">
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
            {/* Hamburger — mobile only */}
            <button
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile navigation panel */}
      <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          className="mobile-nav"
          role="navigation"
          aria-label="Mobile menu"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {currentUser?.admin && (
            <button
              className={`mobile-admin-link ${view === "admin" ? "active" : ""}`}
              onClick={() => { setView("admin"); closeMobileMenu(); }}
              data-testid="button-open-admin-mobile"
            >
              <LayoutDashboard size={17} />
              Admin Panel
            </button>
          )}
          <div className="mobile-nav-section-label">Categories</div>
          <div className="mobile-nav-cats">
            <button
              className="mobile-cat-btn"
              onClick={() => { setView("store"); setCategory("All"); closeMobileMenu(); }}
            >
              All Products
            </button>
            {MOBILE_NAV_CATS.map((cat) => (
              <button
                key={cat}
                className="mobile-cat-btn"
                onClick={() => { setView("store"); setCategory(cat); closeMobileMenu(); }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mobile-nav-bottom">
            <button
              className="mobile-nav-account-btn"
              onClick={() => {
                if (currentUser) setView("account");
                else { setAuthMode("login"); setAuthError(""); setModal("auth"); }
                closeMobileMenu();
              }}
            >
              <UserRound size={16} />
              {currentUser ? `My Account (${currentUser.name})` : "Sign In / Register"}
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </header>
  );
}

/* ─── Ticker ─────────────────────────────────────────────────── */
function Ticker() {
  const items = Array(8).fill("100% ORIGINAL & VERIFIED PRODUCTS");
  return (
    <div className="ticker-wrap" aria-hidden="true">
      <div className="ticker-track">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="ticker-item">{t} <span className="ticker-dot">✦</span></span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STOREFRONT
══════════════════════════════════════════════════════════════════ */
const HERO_PHRASES = [
  "ABSOLUTE POWER",
  "PURE PRECISION",
  "TOTAL CONTROL",
  "UNMATCHED SPEED",
] as const;

const VISIBLE_MS = 1800;
const BLINK_MS   = 700;
const HIDDEN_MS  = 180;

function HeroPhrase() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"visible" | "blinking" | "hidden">("visible");

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    if (phase === "visible") {
      id = setTimeout(() => setPhase("blinking"), VISIBLE_MS);
    } else if (phase === "blinking") {
      id = setTimeout(() => setPhase("hidden"), BLINK_MS);
    } else {
      id = setTimeout(() => {
        setIndex((i) => (i + 1) % HERO_PHRASES.length);
        setPhase("visible");
      }, HIDDEN_MS);
    }
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <em className={`hero-phrase hero-phrase--${phase}`} aria-live="polite">
      {HERO_PHRASES[index]}
    </em>
  );
}

function Storefront({ products, allProducts, category, setCategory, sort, setSort, query, openProduct, addToCart, wishlist, toggleWishlist, heroBackground }: { // eslint-disable-line @typescript-eslint/no-unused-vars
  products: Product[]; allProducts: Product[]; category: "All" | Category;
  setCategory: (v: "All" | Category) => void; sort: string; setSort: (v: string) => void;
  query: string; openProduct: (p: Product) => void; addToCart: (id: string, qty?: number, size?: string, power?: number, speed?: string) => void;
  wishlist: string[]; toggleWishlist: (id: string) => void; heroBackground: string;
}) {
  const featured = allProducts.filter((p) => p.featured).slice(0, 4);

  return (
    <main>
      {/* Hero */}
      <section className="hero" style={heroBackground ? { backgroundImage: `url(${heroBackground})` } : undefined}>
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-eyebrow">THE NEW STANDARD</p>
          <h1 className="hero-title">UNLEASH<br /><HeroPhrase /></h1>
          <p className="hero-sub">Competition-ready rackets, shoes, shuttles & more for India's finest courts.</p>
          <button className="btn-hero" onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}>
            EXPLORE NOW <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-racket-art" aria-hidden="true">
          <img src={officialRacketImages["astrox 100 zz"][0]} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      </section>

      {/* Category quick-links */}
      <section className="category-scroller">
        <div className="category-scroll-inner">
          {ALL_CATEGORIES.map((cat) => (
            <button key={cat} className={`cat-chip ${category === cat ? "active" : ""}`} onClick={() => setCategory(cat)} data-testid={`button-category-${cat.toLowerCase().replace(" ", "-")}`}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      {!query && (
        <section className="section-block">
          <div className="section-head">
            <div><p className="eyebrow">New Arrivals</p><h2 className="section-title">TOP PICKS</h2></div>
            <button className="btn-ghost-sm" onClick={() => setCategory("All")}>View all →</button>
          </div>
          <div className="product-grid">
            {featured.map((p) => <ProductCard key={p.id} product={p} openProduct={openProduct} addToCart={addToCart} isWishlisted={wishlist.includes(p.id)} toggleWishlist={toggleWishlist} />)}
          </div>
        </section>
      )}

      {/* Full catalog */}
      <section className="section-block" id="products-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">{category === "All" ? "Full Catalog" : category}</p>
            <h2 className="section-title">{query ? `RESULTS FOR "${query.toUpperCase()}"` : category === "All" ? "ALL GEAR" : category.toUpperCase()}</h2>
          </div>
          <div className="filter-row">
            <div className="filter-pills">
              <button className={`pill ${category === "All" ? "active" : ""}`} onClick={() => setCategory("All")}>All</button>
              {ALL_CATEGORIES.map((c) => (
                <button key={c} className={`pill ${category === c ? "active" : ""}`} onClick={() => setCategory(c)} data-testid={`button-filter-${c.toLowerCase().replace(" ", "-")}`}>{c}</button>
              ))}
            </div>
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" data-testid="select-sort-products">
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low → High</option>
              <option value="price-high">Price: High → Low</option>
              <option value="name">Name: A–Z</option>
            </select>
          </div>
        </div>
        <div className="product-grid">
          {products.length === 0
            ? <div className="empty-state"><Search size={32} /><strong>No results</strong><span>Try a different search or filter.</span></div>
            : products.map((p) => <ProductCard key={p.id} product={p} openProduct={openProduct} addToCart={addToCart} isWishlisted={wishlist.includes(p.id)} toggleWishlist={toggleWishlist} />)}
        </div>
      </section>

      {!query && (
        <div className="trust-row">
          <div className="trust-item"><BadgeCheck size={22} /><div><strong>100% Genuine</strong><span>Only authentic products from trusted brands</span></div></div>
          <div className="trust-item"><Truck size={22} /><div><strong>Fast Dispatch</strong><span>Orders processed within 1–2 business days</span></div></div>
          <div className="trust-item"><ShieldCheck size={22} /><div><strong>Play-Tested</strong><span>Curated by players, for players</span></div></div>
          <div className="trust-item"><Sparkles size={22} /><div><strong>INR Pricing</strong><span>Competitive prices for Indian courts</span></div></div>
        </div>
      )}
    </main>
  );
}

/* ─── Product Card ───────────────────────────────────────────── */
function ProductCard({ product, openProduct, addToCart, isWishlisted, toggleWishlist }: {
  product: Product; openProduct: (p: Product) => void; addToCart: (id: string, qty?: number, size?: string, power?: number, speed?: string) => void;
  isWishlisted: boolean; toggleWishlist: (id: string) => void;
}) {
  return (
    <article className="product-card" data-testid={`card-product-${product.id}`}>
      <div className="product-img-wrap">
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {product.showcase && <span className="showcase-indicator" title="Has showcase media"><Play size={10} /></span>}
        <button className={`wishlist-btn ${isWishlisted ? "active" : ""}`} onClick={() => toggleWishlist(product.id)} title="Wishlist" data-testid={`button-wishlist-${product.id}`}>
          <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        <button className="img-btn" onClick={() => openProduct(product)} data-testid={`button-view-product-${product.id}`}>
          <img src={product.image} alt={product.name} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(product.category), "#59635a"); }} />
        </button>
      </div>
      <div className="product-body">
        <p className="product-meta-line">{product.category} · {product.brand}</p>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-price-row">
          <span className="price" data-testid={`text-price-${product.id}`}>{money(product.price)}</span>
          {product.compareAt && <span className="price-old">{money(product.compareAt)}</span>}
        </div>
        <button className="btn-add-cart" onClick={() => (product.category === "Shuttlecocks" || (product.availableSizes && product.availableSizes.length > 0)) ? openProduct(product) : addToCart(product.id)} data-testid={`button-add-cart-${product.id}`}>Add to Bag</button>
      </div>
    </article>
  );
}

/* ─── Product Modal ──────────────────────────────────────────── */
function ProductModal({ product, close, addToCart, wishlist, toggleWishlist }: {
  product: Product; close: () => void; addToCart: (id: string, qty?: number, size?: string, power?: number, speed?: string) => void;
  wishlist: string[]; toggleWishlist: (id: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [showShowcase, setShowShowcase] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedSpeed, setSelectedSpeed] = useState<string>("");
  const needsSize = product.availableSizes && product.availableSizes.length > 0;
  const speedOptions = (product.availableSpeeds && product.availableSpeeds.length > 0) ? product.availableSpeeds : ["75", "76", "77", "78"];
  const needsSpeed = product.category === "Shuttlecocks";
  const canAdd = (!needsSize || selectedSize !== "") && (!needsSpeed || selectedSpeed !== "");
  const embedUrl = product.showcase && isYouTubeUrl(product.showcase) ? youtubeEmbedUrl(product.showcase) : null;

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.section className="modal modal-wide" role="dialog" aria-modal="true" data-testid="modal-product-detail" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
        <button className="modal-close" onClick={close} data-testid="button-close-product"><X size={22} /></button>
        <div className="modal-product-layout">
          <div className="modal-product-img">
            {!showShowcase || !product.showcase ? (
              <img src={product.image} alt={product.name} onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(product.category), "#59635a"); }} />
            ) : embedUrl ? (
              <iframe src={embedUrl} title="Product video" allowFullScreen className="showcase-iframe" />
            ) : (
              <img src={product.showcase} alt={`${product.name} showcase`} onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(product.category), "#59635a"); }} />
            )}
            {product.showcase && (
              <div className="showcase-toggle-row">
                <button className={`showcase-tab ${!showShowcase ? "active" : ""}`} onClick={() => setShowShowcase(false)}>Photo</button>
                <button className={`showcase-tab ${showShowcase ? "active" : ""}`} onClick={() => setShowShowcase(true)}>
                  {embedUrl ? <><Play size={12} /> Video</> : "Showcase"}
                </button>
              </div>
            )}
          </div>
          <div className="modal-product-info">
            <p className="product-meta-line">{product.category} · {product.brand}</p>
            <h2 className="modal-product-name">{product.name}</h2>
            <p className="modal-product-desc">{product.description}</p>
            {product.tags.length > 0 && (
              <div className="tag-row">{product.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
            )}
            <div className="modal-price">
              {money(product.price)}
              {product.compareAt && <span className="price-old" style={{ fontSize: 16, marginLeft: 10 }}>{money(product.compareAt)}</span>}
            </div>
            {needsSpeed && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: "block" }}>Speed <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {speedOptions.map((s) => (
                    <button key={s} type="button"
                      className={selectedSpeed === s ? "btn-primary" : "btn-ghost"}
                      style={{ minWidth: 64, fontWeight: 700, fontSize: 15 }}
                      onClick={() => setSelectedSpeed(s)}
                    >{s}</button>
                  ))}
                </div>
                {selectedSpeed === "" && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Please select a speed</p>}
              </div>
            )}
            {needsSize && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: "block" }}>Size <span style={{ color: "#ef4444" }}>*</span></label>
                <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} style={{ width: "100%" }}>
                  <option value="">— Select a size —</option>
                  {product.availableSizes!.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {selectedSize === "" && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Please select a size</p>}
              </div>
            )}
            <div className="qty-row">
              <div className="qty-ctrl">
                <button onClick={() => setQty(Math.max(1, qty - 1))} data-testid="button-detail-decrease"><Minus size={15} /></button>
                <span data-testid="text-detail-quantity">{qty}</span>
                <button onClick={() => setQty(qty + 1)} data-testid="button-detail-increase"><Plus size={15} /></button>
              </div>
              <button className="btn-primary btn-full-row" disabled={!canAdd} onClick={() => { if (canAdd) { addToCart(product.id, qty, needsSize ? selectedSize : undefined, undefined, needsSpeed ? selectedSpeed : undefined); close(); } }} data-testid="button-detail-add">
                Add {qty > 1 ? `${qty} ` : ""}to Bag
              </button>
              <button className={`btn-icon-outline ${wishlist.includes(product.id) ? "wishlisted" : ""}`} onClick={() => toggleWishlist(product.id)} data-testid="button-detail-wishlist" title="Wishlist">
                <Heart size={18} fill={wishlist.includes(product.id) ? "currentColor" : "none"} />
              </button>
            </div>
            <p className="modal-ship-note"><Truck size={13} /> Free delivery on orders above ₹2,500</p>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

/* ─── Cart Drawer ────────────────────────────────────────────── */
function CartDrawer({ cart, products, close, updateQty, openProduct, total, requireAuth, setModal, toast }: {
  cart: CartLine[]; products: Product[]; close: () => void; updateQty: (key: string, n: number) => void;
  openProduct: (p: Product) => void; total: number; requireAuth: () => boolean;
  setModal: (v: Modal) => void; toast: (msg: string, err?: boolean) => void;
}) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.aside className="drawer" aria-label="Cart" data-testid="drawer-cart" initial={{ opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 48 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
        <div className="drawer-header">
          <h2>Your Bag <span className="cart-count-text">({cart.reduce((s, l) => s + l.quantity, 0)})</span></h2>
          <button className="modal-close" onClick={close} data-testid="button-close-cart"><X size={20} /></button>
        </div>
        <div className="drawer-body">
          {cart.length === 0
            ? <div className="empty-state" style={{ marginTop: 40 }}>
                <ShoppingBag size={32} /><strong>Your bag is empty</strong><span>Add gear to get started.</span>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={close} data-testid="button-continue-shopping">Continue Shopping</button>
              </div>
            : cart.map((line) => {
                const p = products.find((x) => x.id === line.productId);
                if (!p) return null;
                return (
                  <div className="cart-line" key={`${line.productId}:${line.size ?? ""}:${line.power ?? ""}:${line.speed ?? ""}`} data-testid={`row-cart-${line.productId}`}>
                    <button className="cart-img-btn" onClick={() => { close(); openProduct(p); }}>
                      <img src={p.image} alt={p.name} onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(p.category), "#59635a"); }} />
                    </button>
                    <div className="cart-line-info">
                      <h4>{p.name}</h4>
                      <p>{p.brand} · {money(p.price)}</p>
                      {(line.size || line.power || line.speed) && (
                        <p style={{ fontSize: 11, color: "rgb(var(--paper-muted))", marginTop: 2 }}>
                          {line.size ? `Size: ${line.size}` : ""}{line.size && (line.power || line.speed) ? " · " : ""}{line.power ? `Power: ${line.power}` : ""}{line.power && line.speed ? " · " : ""}{line.speed ? `Speed: ${line.speed}` : ""}
                        </p>
                      )}
                      <div className="qty-ctrl sm">
                        <button onClick={() => updateQty(`${line.productId}:${line.size ?? ""}:${line.power ?? ""}:${line.speed ?? ""}`, -1)} data-testid={`button-cart-decrease-${p.id}`}><Minus size={12} /></button>
                        <span>{line.quantity}</span>
                        <button onClick={() => updateQty(`${line.productId}:${line.size ?? ""}:${line.power ?? ""}:${line.speed ?? ""}`, 1)} data-testid={`button-cart-increase-${p.id}`}><Plus size={12} /></button>
                      </div>
                    </div>
                    <div className="cart-line-right">
                      <span>{money(p.price * line.quantity)}</span>
                      <button className="remove-btn" onClick={() => { updateQty(`${line.productId}:${line.size ?? ""}:${line.power ?? ""}:${line.speed ?? ""}`, -line.quantity); toast("Removed from bag."); }} data-testid={`button-remove-cart-${p.id}`}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })
          }
        </div>
        {cart.length > 0 && (
          <div className="drawer-footer">
            <div className="total-row"><span>Order Total</span><span data-testid="text-cart-total">{money(total)}</span></div>
            <button className="btn-primary btn-full" onClick={() => { close(); setModal("checkout"); }} data-testid="button-checkout">
              <CreditCard size={16} /> Proceed to Checkout
            </button>
            <p className="demo-note">Pay securely via UPI on the next step.</p>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

/* ─── Auth Modal ─────────────────────────────────────────────── */
function AuthModal({ mode, setMode, close, submit, error }: {
  mode: "login" | "register"; setMode: (m: "login" | "register") => void;
  close: () => void; submit: (email: string, password: string, name: string) => void; error: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.section className="modal" role="dialog" aria-modal="true" data-testid="modal-auth" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
        <button className="modal-close" onClick={close} data-testid="button-close-auth"><X size={20} /></button>
        <div className="modal-auth-brand"><span className="brand-mark sm">B</span><span>Badminton Bazaar</span></div>
        <div className="modal-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} data-testid="button-auth-login-tab">Sign In</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} data-testid="button-auth-register-tab">Register</button>
        </div>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); submit(email, password, name); }}>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="auth-name">Full Name</label>
              <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="input-auth-name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email Address</label>
            <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required data-testid="input-auth-email" />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="pw-wrap">
              <input id="auth-password" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required data-testid="input-auth-password" />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          {error && <div className="form-error" data-testid="status-auth-error">{error}</div>}
          <button className="btn-primary btn-full" type="submit" data-testid="button-submit-auth">
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
          {mode === "login" && (
            <p className="auth-switch-note">
              Don't have an account? <button type="button" className="link-btn" onClick={() => setMode("register")}>Register here</button>
            </p>
          )}
          {mode === "register" && (
            <p className="auth-switch-note">
              Already have an account? <button type="button" className="link-btn" onClick={() => setMode("login")}>Sign in</button>
            </p>
          )}
        </form>
      </motion.section>
    </motion.div>
  );
}

/* ─── Checkout Modal — UPI payment proof flow ────────────────── */
function CheckoutModal({
  close, total, user, items, founderEmail, submitOrder,
}: {
  close: () => void;
  total: number;
  user: User | null;
  items: { name: string; quantity: number; price: number; size?: string; power?: number; speed?: string }[];
  founderEmail: string;
  submitOrder: (details: Omit<Order, "id" | "userId" | "status" | "reviewMessage" | "createdAt" | "items" | "total">) => Promise<Order>;
}) {
  const [step, setStep] = useState<"details" | "payment" | "success">("details");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [additionalContact, setAdditionalContact] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [proofName, setProofName] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  const readProof = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image of your payment proof."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Payment proof must be 4 MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => { setPaymentProof(String(reader.result)); setProofName(file.name); setError(""); };
    reader.readAsDataURL(file);
  };

  const createPendingOrder = () => {
    if (!name.trim() || !email.includes("@") || !phone.trim() || !address.trim()) {
      setError("Please complete your name, email, phone number, and delivery address."); return;
    }
    setStep("payment"); setError("");
  };

  const submitPayment = async () => {
    if (!paymentReference.trim()) { setError("Enter the UPI transaction/reference number."); return; }
    if (!paymentProof) { setError("Upload a screenshot or image of your payment proof."); return; }
    setSending(true);
    setError("");
    const order = await submitOrder({
      customerName: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      additionalContact: additionalContact.trim(),
      paymentReference: paymentReference.trim(),
      paymentProof,
    });
    let sent = false;
    try {
      await sendOrderEmail({
        founderEmail,
        orderId: order.id,
        customerName: order.customerName,
        customerEmail: order.email,
        customerPhone: order.phone,
        customerAddress: order.address,
        additionalContact: order.additionalContact,
        paymentReference: order.paymentReference,
        paymentProof: order.paymentProof,
        items: order.items,
        total: order.total,
        createdAt: order.createdAt,
      });
      sent = true;
    } catch (err) {
      console.error("[Badminton Bazaar] Email notification failed:", err);
    }
    setSending(false);
    setEmailSent(sent);
    setCreatedOrder(order);
    setStep("success");
  };

  if (step === "success" && createdOrder) {
    return (
      <div className="modal-backdrop">
        <section className="modal" role="dialog" data-testid="modal-checkout">
          <div className="success-body">
            <div className="success-icon"><Check size={30} /></div>
            <h2>Payment Submitted</h2>
            <p style={{ fontSize: 15, color: "rgb(var(--paper-bright))", fontWeight: 600 }}>
              Invoice {createdOrder.id} is pending payment review.
            </p>
            <p>We saved your order details and payment proof. The founder will verify the payment before dispatch.</p>
            <div className="pending-order-note">
              <strong>Founder review</strong>
              <span>{founderEmail}</span>
              {emailSent === true && (
                <small style={{ color: "#4ade80" }}>
                  ✓ Invoice and payment proof have been emailed to the founder.
                </small>
              )}
              {emailSent === false && (
                <small>
                  The founder has been notified via the admin panel. If payment is not received or cannot be recognised, they will contact you at {createdOrder.phone} or {createdOrder.email}.
                </small>
              )}
              {emailSent === null && (
                <small>
                  If the payment is not received or cannot be recognised, the founder will contact you at {createdOrder.phone} or {createdOrder.email}.
                </small>
              )}
            </div>
            <button className="btn-primary btn-full" onClick={close} data-testid="button-close-checkout-success">
              Back to Store
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (step === "payment") {
    return (
      <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <section className="modal" role="dialog" data-testid="modal-checkout">
          <button className="modal-close" onClick={close} data-testid="button-close-checkout"><X size={20} /></button>
          <div className="upi-payment-block">
            <p className="eyebrow" style={{ padding: "24px 28px 0", marginBottom: 4 }}>Step 2 of 2</p>
            <h2 style={{ fontFamily: "var(--app-font-display)", fontSize: 32, textTransform: "uppercase", padding: "0 28px 16px" }}>Pay & Upload Proof</h2>
            <div className="upi-amount-bar"><span>Total to pay</span><strong>{money(total)}</strong></div>
            <div className="upi-qr-wrap">
              <img src={qrImg} alt="UPI QR Code — Jignesh Makwana" className="upi-qr-img" />
              <p className="upi-id-line">UPI ID: <strong>jignesh32@ptaxis</strong></p>
              <p className="upi-hint">Pay the exact amount, then upload your payment screenshot and enter the UPI reference number.</p>
            </div>
            <div className="checkout-form">
              <div className="field">
                <label htmlFor="payment-reference">UPI Transaction / Reference Number</label>
                <input id="payment-reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Enter the UTR or transaction ID" data-testid="input-payment-reference" />
              </div>
              <div className="field">
                <label htmlFor="payment-proof">Payment Proof</label>
                <label className="btn-upload-img" htmlFor="payment-proof"><FileImage size={16} /> {proofName || "Upload payment screenshot"}</label>
                <input id="payment-proof" type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && readProof(e.target.files[0])} data-testid="input-payment-proof" />
              </div>
              {paymentProof && <img className="proof-preview" src={paymentProof} alt="Payment proof preview" />}
              {error && <div className="form-error">{error}</div>}
              <button
                className="btn-primary btn-full"
                onClick={submitPayment}
                disabled={sending}
                data-testid="button-submit-payment-proof"
              >
                {sending
                  ? <><Loader2 size={16} className="spin" /> Sending invoice…</>
                  : <><Upload size={16} /> Submit Payment Proof & Create Invoice</>}
              </button>
              <button className="btn-ghost btn-full" onClick={() => setStep("details")}>← Back to Delivery Details</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <section className="modal" role="dialog" data-testid="modal-checkout">
        <button className="modal-close" onClick={close} data-testid="button-close-checkout"><X size={20} /></button>
        <div className="checkout-block">
          <p className="eyebrow" style={{ marginBottom: 4 }}>Step 1 of 2</p>
          <h2 style={{ fontFamily: "var(--app-font-display)", fontSize: 32, textTransform: "uppercase", marginBottom: 8 }}>Delivery Details</h2>
          <p className="checkout-message">These details will appear on your invoice and help the founder contact you about delivery.</p>
          <div className="checkout-total-row"><span>Order Total</span><strong>{money(total)}</strong></div>
          <div className="checkout-form">
            <div className="field"><label htmlFor="checkout-name">Full Name</label><input id="checkout-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name for delivery" data-testid="input-checkout-name" /></div>
            <div className="field"><label htmlFor="checkout-email">Customer Email</label><input id="checkout-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Where we can send updates" data-testid="input-checkout-email" /></div>
            <div className="field"><label htmlFor="checkout-phone">Phone Number</label><input id="checkout-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Delivery contact number" data-testid="input-checkout-phone" /></div>
            <div className="field"><label htmlFor="checkout-address">Full Delivery Address</label><textarea id="checkout-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, city, state, PIN code" data-testid="input-checkout-address" /></div>
            <div className="field"><label htmlFor="checkout-additional">Additional Contact Information <span className="optional-label">(optional)</span></label><textarea id="checkout-additional" rows={2} value={additionalContact} onChange={(e) => setAdditionalContact(e.target.value)} placeholder="Alternate number, WhatsApp, delivery notes…" data-testid="input-checkout-additional" /></div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary btn-full" onClick={createPendingOrder} data-testid="button-proceed-to-payment"><CreditCard size={16} /> Continue to UPI Payment</button>
            <button className="btn-ghost btn-full" style={{ marginTop: 10 }} onClick={close}>Cancel</button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Add User Modal ─────────────────────────────────────────── */
function AddUserModal({ close, users, setUsers, toast }: {
  close: () => void; users: User[]; setUsers: (v: User[]) => void; toast: (msg: string, err?: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast("Name is required.", true); return; }
    if (!email.includes("@")) { toast("Enter a valid email.", true); return; }
    if (password.length < 4) { toast("Password needs at least 4 characters.", true); return; }
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) { toast("Email already in use.", true); return; }
    const user: User = { id: `u-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), password, admin: isAdmin, joined: new Date().toLocaleDateString("en-IN") };
    setIsSaving(true);
    try {
      await createApiUser(user);
      setUsers([...users, user]);
      toast(`User "${user.name}" added.`);
      close();
    } catch {
      toast("Failed to save user to database. Please try again.", true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <section className="modal" role="dialog" aria-modal="true" data-testid="modal-add-user">
        <button className="modal-close" onClick={close}><X size={20} /></button>
        <div className="modal-header-block"><h2>Add New User</h2></div>
        <form className="modal-form" onSubmit={submit}>
          <div className="field"><label htmlFor="nu-name">Full Name</label><input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="User's name" required /></div>
          <div className="field"><label htmlFor="nu-email">Email Address</label><input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required /></div>
          <div className="field"><label htmlFor="nu-password">Password</label><input id="nu-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 4 characters" required /></div>
          <div className="field-check">
            <input id="nu-admin" type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            <label htmlFor="nu-admin">Grant Admin Access</label>
          </div>
          <button className="btn-primary btn-full" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Add User"}
          </button>
        </form>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ACCOUNT PAGE
══════════════════════════════════════════════════════════════════ */
function Account({ user, orders, updateUser, signOut, toast, ordersLoaded }: {
  user: User; orders: Order[]; updateUser: (u: User) => void; signOut: () => void; toast: (msg: string, err?: boolean) => void; ordersLoaded: boolean;
}) {
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const initials = user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const saveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) { toast("Enter a valid email.", true); return; }
    updateUser({ ...user, email: newEmail.trim().toLowerCase() });
    toast("Email updated successfully.");
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) { toast("Password must be at least 4 characters.", true); return; }
    if (newPassword !== confirmPw) { toast("Passwords do not match.", true); return; }
    updateUser({ ...user, password: newPassword });
    setNewPassword(""); setConfirmPw("");
    toast("Password updated successfully.");
  };

  return (
    <main className="account-page">
      <div className="account-container">
        <div className="account-header">
          <div className="account-avatar">{initials}</div>
          <div>
            <h1 data-testid="text-account-name">{user.name}</h1>
            <p data-testid="text-account-email">{user.email}</p>
            {user.admin && <span className="admin-pill">Admin</span>}
          </div>
          <button className="btn-ghost" onClick={signOut} style={{ marginLeft: "auto" }} data-testid="button-account-signout">Sign Out</button>
        </div>
        <div className="account-cards">
          <section className="account-card">
            <h2><Package size={18} /> Order History</h2>
            {!ordersLoaded ? <p className="card-desc">Loading your shared order history…</p> : orders.length === 0 ? <p className="card-desc">No orders yet. Shop our catalog to get started.</p> : (
              <div className="order-list">
                {orders.map((order) => (
                  <InvoiceCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
          <section className="account-card">
            <h2>Change Email</h2>
            <form onSubmit={saveEmail}>
              <div className="field"><label htmlFor="acc-email">New Email Address</label><input id="acc-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="input-account-email" /></div>
              <button className="btn-primary" type="submit" data-testid="button-save-email">Save Email</button>
            </form>
          </section>
          <section className="account-card">
            <h2>Change Password</h2>
            <form onSubmit={savePassword}>
              <div className="field">
                <label htmlFor="acc-pw">New Password</label>
                <div className="pw-wrap">
                  <input id="acc-pw" type={showPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 4 characters" data-testid="input-account-password" />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </div>
              <div className="field"><label htmlFor="acc-pw-confirm">Confirm Password</label><input id="acc-pw-confirm" type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password" /></div>
              <button className="btn-primary" type="submit" data-testid="button-save-password">Save Password</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function InvoiceCard({ order }: { order: Order }) {
  const statusLabel = order.status === "approved" ? "Payment approved" : order.status === "rejected" ? "Payment not approved" : "Payment pending review";
  const downloadInvoice = () => {
    const lines = [
      `BADMINTON BAZAAR — INVOICE ${order.id}`,
      `Date: ${new Date(order.createdAt).toLocaleString("en-IN")}`,
      "",
      `Customer: ${order.customerName}`,
      `Email: ${order.email}`,
      `Phone: ${order.phone}`,
      `Address: ${order.address}`,
      order.additionalContact ? `Additional contact: ${order.additionalContact}` : "",
      "",
      ...order.items.map((item) => `${item.name} (${item.brand}) × ${item.quantity} — ${money(item.price * item.quantity)}`),
      "",
      `Total: ${money(order.total)}`,
      `Payment reference: ${order.paymentReference}`,
      `Status: ${statusLabel}`,
      order.reviewMessage ? `Review message: ${order.reviewMessage}` : "",
    ].filter(Boolean).join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${order.id}-invoice.txt`; link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <article className="order-card" data-testid={`order-card-${order.id}`}>
      <div className="order-card-head">
        <div><strong>{order.id}</strong><span>{new Date(order.createdAt).toLocaleDateString("en-IN")}</span></div>
        <span className={`status-pill ${order.status}`}>{statusLabel}</span>
      </div>
      <div className="order-card-items">
        {order.items.map((item) => <span key={`${order.id}-${item.name}-${item.size ?? ""}-${item.power ?? ""}-${item.speed ?? ""}`}>{item.name}{item.size ? ` [${item.size}]` : ""}{item.power ? ` [Power ${item.power}]` : ""}{item.speed ? ` [Speed: ${item.speed}]` : ""} × {item.quantity}</span>)}
      </div>
      <div className="order-card-foot"><strong>{money(order.total)}</strong><button className="btn-ghost btn-small" onClick={downloadInvoice}><Download size={14} /> Download Invoice</button></div>
      {order.reviewMessage && <p className="review-message">{order.reviewMessage}</p>}
    </article>
  );
}

function OrderReviewCard({ order, updateOrder, deleteOrder, toast }: {
  order: Order;
  updateOrder: (id: string, status: OrderStatus, message: string) => void;
  deleteOrder: (id: string) => Promise<void>;
  toast: (msg: string, err?: boolean) => void;
}) {
  const [step, setStep] = useState<"idle" | "approving" | "rejecting">("idle");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState(order.reviewMessage || "");
  const [sending, setSending] = useState(false);
  const isPending = order.status === "pending";

  const confirmApprove = async () => {
    if (!deliveryDate.trim()) { toast("Please enter a message for the customer before approving.", true); return; }
    setSending(true);
    try {
      await updateOrder(order.id, "approved", deliveryDate.trim());
    } catch {
      toast(`${order.id} could not be approved. Please try again.`, true);
      setSending(false);
      return;
    }
    try {
      await sendStatusEmail({
        customerEmail: order.email,
        customerName: order.customerName,
        orderId: order.id,
        status: "approved",
        statusMessage: deliveryDate.trim(),
        items: order.items,
        total: order.total,
      });
      toast(`${order.id} approved — customer notified by email.`);
    } catch {
      toast(`${order.id} approved. Customer email failed — contact them manually.`, true);
    }
    setSending(false);
    setStep("idle");
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) { toast("Please enter a reason before rejecting.", true); return; }
    setSending(true);
    const reason = rejectionReason.trim();
    try {
      await updateOrder(order.id, "rejected", reason);
    } catch {
      toast(`${order.id} could not be rejected. Please try again.`, true);
      setSending(false);
      return;
    }
    try {
      await sendStatusEmail({
        customerEmail: order.email,
        customerName: order.customerName,
        orderId: order.id,
        status: "rejected",
        statusMessage: reason,
        items: order.items,
        total: order.total,
      });
      toast(`${order.id} rejected — customer notified by email.`);
    } catch {
      toast(`${order.id} rejected. Customer email failed — contact them manually.`, true);
    }
    setSending(false);
    setStep("idle");
  };

  return (
    <article className={`order-review-card ${order.status}`} data-testid={`order-review-${order.id}`}>
      <div className="order-review-head">
        <div>
          <strong>{order.id}</strong>
          <span>{new Date(order.createdAt).toLocaleString("en-IN")}</span>
        </div>
        <span className={`status-pill ${order.status}`}>{order.status === "pending" ? "Needs review" : order.status}</span>
      </div>
      <div className="order-review-grid">
        <div className="order-review-details">
          <h3>{order.customerName}</h3>
          <p><Mail size={14} /> {order.email}</p>
          <p><Phone size={14} /> {order.phone}</p>
          <p className="address-line"><strong>Deliver to:</strong> {order.address}</p>
          {order.additionalContact && <p className="address-line"><strong>Additional:</strong> {order.additionalContact}</p>}
          <div className="review-items">{order.items.map((item) => <span key={`${order.id}-${item.name}-${item.size ?? ""}-${item.power ?? ""}-${item.speed ?? ""}`}>{item.name}{item.size ? ` [${item.size}]` : ""}{item.power ? ` [Power ${item.power}]` : ""}{item.speed ? ` [Speed: ${item.speed}]` : ""} × {item.quantity} — {money(item.price * item.quantity)}</span>)}</div>
          <div className="review-total"><span>Total</span><strong>{money(order.total)}</strong></div>
          <p className="payment-reference"><strong>UPI reference:</strong> {order.paymentReference}</p>
        </div>
        <div className="proof-panel">
          <span className="proof-label">Uploaded payment proof</span>
          <a href={order.paymentProof} target="_blank" rel="noreferrer"><img src={order.paymentProof} alt={`Payment proof for ${order.id}`} /></a>
          <a className="btn-ghost btn-small" href={order.paymentProof} download={`${order.id}-payment-proof`}><Download size={14} /> Download proof</a>
        </div>
      </div>

      {isPending && step === "idle" && (
        <div className="review-actions">
          <div className="review-buttons">
            <a className="btn-ghost btn-small" href={`tel:${order.phone}`}><Phone size={14} /> Call customer</a>
            <a className="btn-ghost btn-small" href={`mailto:${order.email}`}><Mail size={14} /> Email customer</a>
            <button className="btn-danger btn-small" onClick={() => { setStep("rejecting"); }} data-testid={`button-reject-${order.id}`}>
              Reject / Follow up
            </button>
            <button className="btn-primary btn-small" onClick={() => { setStep("approving"); }} data-testid={`button-approve-${order.id}`}>
              <Check size={14} /> Approve payment
            </button>
          </div>
        </div>
      )}

      {isPending && step === "approving" && (
        <div className="review-actions">
          <p style={{ fontSize: 13, color: "rgb(var(--neon-cyan))", marginBottom: 6 }}>
            Enter a message for the customer — this will be emailed to them.
          </p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor={`delivery-date-${order.id}`}>Message to Customer</label>
            <input
              id={`delivery-date-${order.id}`}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              placeholder="Write your approval message here…"
              autoFocus
            />
          </div>
          <div className="review-buttons">
            <button className="btn-ghost btn-small" onClick={() => setStep("idle")} disabled={sending}>Cancel</button>
            <button
              className="btn-primary btn-small"
              onClick={confirmApprove}
              disabled={!deliveryDate.trim() || sending}
              data-testid={`button-confirm-approve-${order.id}`}
            >
              {sending ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              {sending ? "Sending…" : "Confirm & Notify Customer"}
            </button>
          </div>
        </div>
      )}

      {isPending && step === "rejecting" && (
        <div className="review-actions">
          <p style={{ fontSize: 13, color: "rgb(var(--danger))", marginBottom: 6 }}>
            Enter the rejection reason — this will be emailed to the customer.
          </p>
          <textarea
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Payment amount did not match the order total. Please retry or contact us for help."
            autoFocus
          />
          <div className="review-buttons">
            <button className="btn-ghost btn-small" onClick={() => setStep("idle")} disabled={sending}>Cancel</button>
            <button
              className="btn-danger btn-small"
              onClick={confirmReject}
              disabled={sending}
              data-testid={`button-confirm-reject-${order.id}`}
            >
              {sending ? <Loader2 size={14} className="spin" /> : null}
              {sending ? "Sending…" : "Confirm Rejection & Notify"}
            </button>
          </div>
        </div>
      )}

      {!isPending && (
        <div className="review-complete">
          <span>{order.reviewMessage}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn-ghost btn-small" href={`mailto:${order.email}`}><Mail size={14} /> Contact customer</a>
            <button
              className="btn-danger btn-small"
              onClick={async () => {
                if (!window.confirm(`Delete order ${order.id}? This cannot be undone.`)) return;
                try {
                  await deleteOrder(order.id);
                  toast(`Order ${order.id} deleted.`);
                } catch {
                  toast(`Could not delete ${order.id}. Please try again.`, true);
                }
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/* ════════════════════════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════════════════════════ */
function Admin({ products, users, toggleUserAdmin, deleteUser, heroBackground, setHeroBackground, orders, updateOrder, deleteOrder, toast, modal, setModal, editingProduct, setEditingProduct, saveProduct, deleteProduct, refreshOrders, ordersRefreshing }: {
  products: Product[]; users: User[]; toggleUserAdmin: (user: User) => Promise<void>; deleteUser: (user: User) => Promise<void>;
  heroBackground: string; setHeroBackground: (v: string) => void;
  orders: Order[];
  updateOrder: (id: string, status: OrderStatus, message: string) => void;
  deleteOrder: (id: string) => Promise<void>;
  toast: (msg: string, err?: boolean) => void; modal: Modal; setModal: (v: Modal) => void;
  editingProduct: Product | null; setEditingProduct: (p: Product | null) => void;
  saveProduct: (p: Product) => void; deleteProduct: (id: string) => void;
  refreshOrders: () => Promise<void>; ordersRefreshing: boolean;
}) {
  const [location, setLocation] = useLocation();
  const activeTab = ((): "products" | "orders" | "users" | "settings" => {
    if (location.endsWith("/products")) return "products";
    if (location.endsWith("/users")) return "users";
    if (location.endsWith("/settings")) return "settings";
    return "orders";
  })();
  const setActiveTab = (tab: "products" | "orders" | "users" | "settings") => setLocation(`/admin/${tab}`);
  const [bgUrl, setBgUrl] = useState(heroBackground);
  const allDisplayUsers = users;

  return (
    <main className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <div><p className="eyebrow">Control Panel</p><h1>Admin Dashboard</h1></div>
          <button className="btn-primary" onClick={() => setEditingProduct({ id: `p-${Date.now()}`, name: "", brand: "", category: "Rackets", price: 0, description: "", image: svgArt("racket", "#59635a"), tags: [], featured: false })} data-testid="button-add-product">
            <Plus size={16} /> Add Product
          </button>
        </div>
        <div className="stats-row">
          <div className="stat-card"><span>Pending Payments</span><strong data-testid="stat-pending-order-count">{orders.filter((o) => o.status === "pending").length}</strong></div>
          <div className="stat-card"><span>Products</span><strong data-testid="stat-product-count">{products.length}</strong></div>
          <div className="stat-card"><span>Registered Users</span><strong data-testid="stat-user-count">{users.filter((u) => !u.admin).length}</strong></div>
        </div>

        <div className="admin-tabs">
          {(["orders", "products", "users", "settings"] as const).map((tab) => (
            <button key={tab} className={`admin-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "orders" && (
          <div className="admin-panel">
            <div className="panel-header">
              <div><h2>Payment Review</h2><p className="panel-subtitle">Review the uploaded proof before contacting the customer or approving dispatch.</p></div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="panel-count">{orders.length} invoices</span>
                <button
                  className="btn-ghost btn-small"
                  onClick={refreshOrders}
                  disabled={ordersRefreshing}
                  title="Refresh orders"
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <RefreshCw size={14} className={ordersRefreshing ? "spin" : ""} />
                  {ordersRefreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
            {orders.length === 0 ? <div className="empty-state admin-empty"><Package size={28} /><strong>No payment proofs yet</strong><span>New checkout submissions will appear here.</span></div> : (
              <div className="order-review-list">
                {orders.map((order) => <OrderReviewCard key={order.id} order={order} updateOrder={updateOrder} deleteOrder={deleteOrder} toast={toast} />)}
              </div>
            )}
          </div>
        )}

        {activeTab === "products" && (
          <div className="admin-panel">
            <div className="panel-header"><h2>Product Catalog</h2><span className="panel-count">{products.length} items</span></div>
            <div className="admin-table-wrap">
              <table className="admin-table" data-testid="table-products">
                <thead><tr><th>Product</th><th>Brand</th><th>Category</th><th>Price</th><th>Compare At</th><th>Showcase</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} data-testid={`row-admin-product-${p.id}`}>
                      <td><div className="table-product"><img src={p.image} alt="" onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(p.category), "#59635a"); }} /><strong>{p.name}</strong></div></td>
                      <td>{p.brand}</td>
                      <td><span className="cat-pill">{p.category}</span></td>
                      <td>{money(p.price)}</td>
                      <td>{p.compareAt ? money(p.compareAt) : "—"}</td>
                      <td>{p.showcase ? <span title={p.showcase}>{isYouTubeUrl(p.showcase) ? "▶ Video" : "🖼 Image"}</span> : "—"}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-table-action" onClick={() => setEditingProduct(p)} data-testid={`button-edit-product-${p.id}`} title="Edit"><Edit3 size={14} /></button>
                          <button className="btn-table-action danger" onClick={() => deleteProduct(p.id)} data-testid={`button-delete-product-${p.id}`} title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="admin-panel">
            <div className="panel-header">
              <h2>User Management</h2>
              <button className="btn-primary" onClick={() => setModal("add-user")} data-testid="button-add-user"><UserPlus size={15} /> Add User</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table" data-testid="table-users">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {allDisplayUsers.map((u) => (
                    <tr key={u.id} data-testid={`row-admin-user-${u.id}`}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className={`role-pill ${u.admin ? "admin" : "user"}`}>{u.admin ? "Admin" : "User"}</span></td>
                      <td>{u.joined}</td>
                      <td>
                        <div className="action-btns">
                          {u.id !== "u-admin" && (
                            <>
                              <button className="btn-table-action" onClick={() => { void toggleUserAdmin(u); }} data-testid={`button-toggle-admin-${u.id}`} title={u.admin ? "Revoke admin" : "Make admin"}><ShieldCheck size={14} /></button>
                              <button className="btn-table-action danger" onClick={() => { void deleteUser(u); }} data-testid={`button-delete-user-${u.id}`} title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="admin-panel">
            <div className="panel-header"><h2>Store Settings</h2></div>
            <div className="settings-section">
              <h3>Hero Background Image</h3>
              <p className="settings-desc">Set a custom background image URL for the hero banner. Leave blank to use the default dark gradient.</p>
              <div className="field"><label htmlFor="hero-bg">Image URL</label><input id="hero-bg" value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="https://example.com/banner.jpg" data-testid="input-hero-background" /></div>
              <div className="settings-actions">
                <button className="btn-primary" onClick={() => { setHeroBackground(bgUrl); toast("Hero background updated."); }}>Apply Background</button>
                {heroBackground && <button className="btn-ghost" onClick={() => { setHeroBackground(""); setBgUrl(""); toast("Background removed."); }}>Remove</button>}
              </div>
              {heroBackground && <div className="bg-preview"><img src={heroBackground} alt="Preview" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ─── Product Editor Modal ───────────────────────────────────── */
function ProductEditor({ product, close, save }: {
  product: Product; close: () => void; save: (p: Product) => void;
}) {
  const [draft, setDraft] = useState<Product>({ ...product });
  const [tagsStr, setTagsStr] = useState(product.tags.join(", "));
  const [sizesStr, setSizesStr] = useState(product.availableSizes?.join(", ") ?? "");
  const [compareAtStr, setCompareAtStr] = useState(product.compareAt ? String(product.compareAt) : "");
  const [candidates, setCandidates] = useState<{ label: string; url: string }[]>([]);
  const [loadingImgs, setLoadingImgs] = useState(false);
  const [customUrl, setCustomUrl] = useState("");

  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const fetchImages = () => {
    if (!draft.name.trim()) return;
    setLoadingImgs(true);
    const built = buildImageCandidates(draft.name, draft.category);
    setTimeout(() => { setCandidates(built); setLoadingImgs(false); }, 400);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.brand.trim() || draft.price <= 0) return;
    save({ ...draft, tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean), availableSizes: sizesStr.split(",").map((s) => s.trim()).filter(Boolean), compareAt: compareAtStr ? Number(compareAtStr) : undefined });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <section className="modal modal-wide editor-modal" role="dialog" aria-modal="true" data-testid="modal-product-editor">
        <button className="modal-close" onClick={close} data-testid="button-close-editor"><X size={20} /></button>
        <div className="modal-header-block"><h2>{product.name ? "Edit Product" : "Add Product"}</h2></div>
        <div className="editor-layout">
          <form className="modal-form editor-form" onSubmit={onSubmit} id="product-form">
            <div className="field-row">
              <div className="field"><label htmlFor="pe-name">Product Name *</label><input id="pe-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. ASTROX 100 ZZ" required data-testid="input-product-name" /></div>
              <div className="field"><label htmlFor="pe-brand">Brand *</label><input id="pe-brand" value={draft.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Yonex" required data-testid="input-product-brand" /></div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="pe-category">Category</label>
                <select id="pe-category" value={draft.category} onChange={(e) => set("category", e.target.value as Category)} data-testid="select-product-category">
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="pe-badge">Badge Label</label><input id="pe-badge" value={draft.badge ?? ""} onChange={(e) => set("badge", e.target.value || undefined)} placeholder="e.g. Best Seller, New" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="pe-price">Price (₹) *</label><input id="pe-price" type="number" min="1" value={draft.price || ""} onChange={(e) => set("price", Number(e.target.value))} required data-testid="input-product-price" /></div>
              <div className="field"><label htmlFor="pe-compare">Compare-at Price (₹)</label><input id="pe-compare" type="number" min="1" value={compareAtStr} onChange={(e) => setCompareAtStr(e.target.value)} placeholder="Strikethrough price" /></div>
            </div>
            <div className="field"><label htmlFor="pe-desc">Description</label><textarea id="pe-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Short product description…" data-testid="input-product-description" /></div>
            <div className="field"><label htmlFor="pe-tags">Tags (comma separated)</label><input id="pe-tags" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. head heavy, 4U, stiff" data-testid="input-product-tags" /></div>
            {(draft.category === "Shoes" || draft.category === "Apparel" || draft.category === "Socks") && (
              <div className="field">
                <label htmlFor="pe-sizes">Available Sizes (comma separated)</label>
                <input id="pe-sizes" value={sizesStr} onChange={(e) => setSizesStr(e.target.value)} placeholder={draft.category === "Shoes" ? "e.g. UK 6, UK 7, UK 8, UK 9, UK 10" : "e.g. XS, S, M, L, XL, XXL"} data-testid="input-product-sizes" />
                <span className="field-hint">Customers will choose from these sizes when adding to bag. Leave blank for no size selection.</span>
              </div>
            )}
            {draft.category === "Shuttlecocks" && (
              <div className="field">
                <label>Available Speeds</label>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {["75", "76", "77", "78"].map((s) => {
                    const checked = (draft.availableSpeeds ?? ["75", "76", "77", "78"]).includes(s);
                    return (
                      <label key={s} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = draft.availableSpeeds ?? ["75", "76", "77", "78"];
                            set("availableSpeeds", e.target.checked ? [...current, s] : current.filter((x) => x !== s));
                          }}
                        />
                        {s}
                      </label>
                    );
                  })}
                </div>
                <span className="field-hint">Customers will choose from these speeds when adding to bag. All 4 are shown by default.</span>
              </div>
            )}
            <div className="field">
              <label htmlFor="pe-showcase"><Video size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Showcase URL (optional)</label>
              <input id="pe-showcase" value={draft.showcase ?? ""} onChange={(e) => set("showcase", e.target.value || undefined)} placeholder="Optional YouTube URL or image URL" data-testid="input-product-showcase" />
              <span className="field-hint">Optional: paste a YouTube link or a second product image. Leave blank to show only the main product photo.</span>
            </div>
            <div className="field-check">
              <input id="pe-featured" type="checkbox" checked={!!draft.featured} onChange={(e) => set("featured", e.target.checked)} />
              <label htmlFor="pe-featured">Mark as Featured (shown in New Arrivals)</label>
            </div>
          </form>

          <div className="image-picker-panel">
            <h3>Product Image</h3>
            <div className="current-img-wrap">
              <img src={draft.image} alt="Current" onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(draft.category), "#59635a"); }} />
            </div>

            {/* Upload own image */}
            <div className="upload-img-section">
              <label htmlFor="pe-upload" className="btn-upload-img">
                <Upload size={14} /> Upload Image (optional)
              </label>
              <input
                id="pe-upload"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl) set("image", dataUrl);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <p className="img-hint" style={{ marginTop: 6 }}>Select a local image from your device to use as the product photo.</p>
            </div>

            <button type="button" className="btn-fetch-imgs" onClick={fetchImages} disabled={!draft.name.trim() || loadingImgs} data-testid="button-fetch-images">
              {loadingImgs ? <><Loader2 size={15} className="spin" /> Fetching…</> : <><RefreshCw size={15} /> Fetch Images</>}
            </button>
            <p className="img-hint">{draft.category === "Rackets" ? "Verified official-brand images appear for mapped racket names. No generated images are used." : "No generated image suggestions are used. Paste a real manufacturer or retailer image URL below."}</p>
            {candidates.length > 0 && (
              <div className="candidates-grid">
                {candidates.map((c, i) => (
                  <button type="button" key={i} className={`candidate-btn ${draft.image === c.url ? "selected" : ""}`} onClick={() => set("image", c.url)} data-testid={`button-image-candidate-${i}`}>
                    <img src={c.url} alt={c.label} loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = svgArt(categoryToSvgKind(draft.category), "#59635a"); }} />
                    {draft.image === c.url && <span className="candidate-check"><Check size={14} /></span>}
                  </button>
                ))}
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="pe-custom-url">Paste a product image URL</label>
              <div className="custom-url-row">
                <input id="pe-custom-url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://…" data-testid="input-product-image-url" />
                <button type="button" className="btn-ghost-sm" onClick={() => { if (customUrl) { set("image", customUrl); setCustomUrl(""); } }}>Use</button>
              </div>
            </div>
          </div>
        </div>
        <div className="editor-footer">
          <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
          <button type="submit" form="product-form" className="btn-primary" data-testid="button-save-product">Save Product</button>
        </div>
      </section>
    </div>
  );
}

/* ─── Site Footer ────────────────────────────────────────────── */
function SiteFooter({ setView, setCategory }: { setView: (v: View) => void; setCategory: (c: "All" | Category) => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={logoImg} alt="Badminton Bazaar" className="footer-logo-img" />
          <div><strong>Badminton Bazaar</strong><span>Play More. Win More.</span></div>
        </div>
        <div className="footer-links">
          <div>
            <strong>Shop</strong>
            {["Rackets", "Shoes", "Shuttlecocks", "Strings", "Grips"].map((c) => (
              <button key={c} onClick={() => { setView("store"); setCategory(c as Category); }}>{c}</button>
            ))}
          </div>
          <div>
            <strong>More</strong>
            {["Kit Bags", "Apparel", "Socks", "Accessories", "Wristbands", "Injury Support", "Training & Fitness", "Court Equipment", "Stringing Tools", "Recovery & Nutrition"].map((c) => (
              <button key={c} onClick={() => { setView("store"); setCategory(c as Category); }}>{c}</button>
            ))}
          </div>
          <div>
            <strong>Account</strong>
            <button onClick={() => setView("account")}>My Account</button>
            <button onClick={() => setView("account")}>Order History</button>
          </div>
          <div>
            <strong>Info</strong>
            <span>INR Pricing · Genuine brands only</span>
            <span>Free delivery above ₹2,500</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2025 Badminton Bazaar · All rights reserved</span>
        <span>Prices in INR · Gear curated for Indian courts</span>
      </div>
    </footer>
  );
}

function AppRoot() {
  return <Router><App /></Router>;
}
export default AppRoot;
