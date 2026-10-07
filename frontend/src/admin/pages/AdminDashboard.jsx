import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Radio } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useLedgerLive } from "../../hooks/useLedgerLive";
import { AdminProvider } from "../AdminContext";
import {
  emptySupplier,
  emptyPublisher,
  emptyCategory,
  emptyMint,
  emptyEdit,
  emptyUserForm,
  emptyPasswordForm,
  buildCategoryTree,
  resolveCascadeIds,
} from "../constants";
import {
  shortHash,
  bookName,
  bookAuthors,
  bookCategory,
  bookImage,
  statusOf,
  matchesStockFilter,
  fuzzyScore,
} from "../utils";
import {
  AdminSidebar,
  AdminHeader,
  BusyOverlay,
  ToastHost,
  OverviewTab,
  MintTab,
  BooksTab,
  LedgerTab,
  FaucetTab,
  SalesTab,
  CategoriesTab,
  PublishersTab,
  SuppliersTab,
  UsersTab,
  SystemTab,
  MintModal,
  EditBookModal,
  CategoryModal,
  PublisherModal,
  SupplierModal,
  StockInModal,
  PdfPreviewModal,
  InvoiceModal,
  UserModal,
  UserPasswordModal,
} from "../components";
import {
  canAccessAdmin,
  canAccessTab,
  firstAllowedTab,
  hasScope,
  roleLabel,
} from "../roles";
import "./admin.css";

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const [tab, setTabState] = useState("overview");
  const setTab = useCallback(
    (id) => {
      if (!user || canAccessTab(user.role, id)) setTabState(id);
    },
    [user]
  );
  const [dash, setDash] = useState(null);
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [ledgerNodes, setLedgerNodes] = useState([]);
  const [ledgerTip, setLedgerTip] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    try {
      return localStorage.getItem("bm-admin-side") === "1";
    } catch {
      return false;
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("bm-admin-dark");
      if (saved === "1") return true;
      if (saved === "0") return false;
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    } catch {
      return false;
    }
  });
  const [form, setForm] = useState(emptyMint);
  const [bookQ, setBookQ] = useState("");
  const [bookFilter, setBookFilter] = useState("all");
  const [modal, setModal] = useState(null); // null | "mint" | "edit" | "supplier" | "category" | "publisher" | "stock-in" | "user" | "user-password"
  const [userQ, setUserQ] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordUser, setPasswordUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editMeta, setEditMeta] = useState(emptyEdit);
  const [mintFile, setMintFile] = useState(null);
  const [mintCover, setMintCover] = useState(null);
  const [mintCoverPreview, setMintCoverPreview] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editCover, setEditCover] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState("");
  const [editHasFile, setEditHasFile] = useState(false);
  const [editFileName, setEditFileName] = useState("");
  const [highlightBookId, setHighlightBookId] = useState(null);
  const [supplierQ, setSupplierQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [publisherQ, setPublisherQ] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("all");
  const [publisherForm, setPublisherForm] = useState(emptyPublisher);
  const [editingPublisherId, setEditingPublisherId] = useState(null);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryQ, setCategoryQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  /** id → mở/đóng nhánh cây danh mục */
  const [catExpanded, setCatExpanded] = useState(() => new Set());
  const [sales, setSales] = useState([]);
  const [saleQ, setSaleQ] = useState("");
  const [saleFilter, setSaleFilter] = useState("all");
  const [viewSale, setViewSale] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null); // { url, title, sale }
  const [faucetAddr, setFaucetAddr] = useState("");
  const [faucetAmount, setFaucetAmount] = useState("1");
  const [faucetBatch, setFaucetBatch] = useState("");
  const [faucetForce, setFaucetForce] = useState(true);
  const [faucetResults, setFaucetResults] = useState([]);
  const [deployerInfo, setDeployerInfo] = useState(null);
  const [liveOn, setLiveOn] = useState(false);
  const [liveFlash, setLiveFlash] = useState("");
  const [txAction, setTxAction] = useState("all");
  const [txBookQ, setTxBookQ] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(null);
  const [viewMode, setViewMode] = useState("chain"); // chain | table
  const [bookView, setBookView] = useState(() => {
    try {
      const v = localStorage.getItem("bm-book-view");
      if (v === "grid" || v === "table") return v;
    } catch {
      /* ignore */
    }
    return "table";
  });
  const [stockMovements, setStockMovements] = useState([]);
  const [stockInForm, setStockInForm] = useState({
    bookId: "",
    quantity: "1",
    unitPrice: "0.02",
    supplierId: "",
    note: "",
  });

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const flash = useCallback(
    (text, type = "ok") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, text }]);
      const ms = type === "err" ? 6500 : 4800;
      window.setTimeout(() => dismissToast(id), ms);
    },
    [dismissToast]
  );

  const beginBusy = useCallback((label = "Đang xử lý…") => {
    setBusy(true);
    setBusyLabel(label);
  }, []);

  const endBusy = useCallback(() => {
    setBusy(false);
    setBusyLabel("");
  }, []);

  const toggleSide = useCallback(() => {
    setSideCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("bm-admin-side", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode((d) => {
      const next = !d;
      try {
        localStorage.setItem("bm-admin-dark", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setBookViewMode = useCallback((mode) => {
    setBookView(mode);
    try {
      localStorage.setItem("bm-book-view", mode);
    } catch {
      /* ignore */
    }
  }, []);

  const openMintModal = () => {
    setForm(emptyMint);
    setMintFile(null);
    if (mintCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(mintCoverPreview);
    setMintCover(null);
    setMintCoverPreview("");
    setModal("mint");
  };

  const onMintCoverPick = (file) => {
    if (mintCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(mintCoverPreview);
    if (!file) {
      setMintCover(null);
      setMintCoverPreview("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash("Ảnh bìa tối đa 5MB", "err");
      return;
    }
    setMintCover(file);
    setMintCoverPreview(URL.createObjectURL(file));
  };

  const openEditModal = (b) => {
    if (!b?.bookId && b?.bookId !== 0) {
      flash("Không mở được form sửa — thiếu bookId", "err");
      return;
    }
    try {
      setEditingId(b.bookId);
      const cascade = resolveCascadeIds(b, categories || []);
      const authorsStr = Array.isArray(b.authors)
        ? b.authors.join(", ")
        : b.author || bookAuthors(b) || "";
      setEditMeta({
        name: bookName(b) === "—" ? "" : bookName(b),
        isbn: b.isbn || "",
        category: cascade.category || b.category || "",
        categoryId: cascade.categoryId || "",
        catL1: cascade.catL1 || "",
        catL2: cascade.catL2 || "",
        catL3: cascade.catL3 || "",
        authors: authorsStr === "—" ? "" : authorsStr,
        publisher: b.publisher || "",
        publisherId: b.publisherId
          ? String(b.publisherId)
          : publishers.find((p) => p.name === b.publisher)?._id || "",
        publishYear: b.publishYear != null ? String(b.publishYear) : "",
        price: b.price != null ? String(b.price) : "0",
        quantity: b.quantity != null ? String(b.quantity) : "1",
        description: b.description || "",
        image: bookImage(b) || b.image || "",
        status: statusOf(b) || "available",
      });
      setEditFile(null);
      setEditCover(null);
      setEditCoverPreview("");
      setEditHasFile(Boolean(b.hasFile || b.contentHash));
      setEditFileName(b.fileName || "");
      setModal("edit");
    } catch (err) {
      console.error("openEditModal", err);
      flash(err.message || "Không mở được form sửa sách", "err");
    }
  };

  const closeModal = () => {
    if (busy) return;
    if (editCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(editCoverPreview);
    if (mintCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(mintCoverPreview);
    setModal(null);
    setEditingId(null);
    setEditingSupplierId(null);
    setEditingCategoryId(null);
    setEditingPublisherId(null);
    setEditingUserId(null);
    setPasswordUser(null);
    setUserForm(emptyUserForm);
    setPasswordForm(emptyPasswordForm);
    setEditFile(null);
    setEditCover(null);
    setEditCoverPreview("");
    setMintCover(null);
    setMintCoverPreview("");
    setEditHasFile(false);
    setEditFileName("");
  };

  const openUserModal = (u = null) => {
    if (u) {
      setEditingUserId(u.id || u._id);
      setUserForm({
        name: u.name || "",
        email: u.email || "",
        role: u.role || "user",
        walletAddress: u.walletAddress || "",
        password: "",
        passwordConfirm: "",
      });
    } else {
      setEditingUserId(null);
      setUserForm(emptyUserForm);
    }
    setModal("user");
  };

  const openUserPasswordModal = (u) => {
    if (!u) return;
    setPasswordUser(u);
    setPasswordForm(emptyPasswordForm);
    setModal("user-password");
  };

  const onEditCoverPick = (file) => {
    if (editCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(editCoverPreview);
    if (!file) {
      setEditCover(null);
      setEditCoverPreview("");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash("Ảnh bìa tối đa 5MB", "err");
      return;
    }
    setEditCover(file);
    setEditCoverPreview(URL.createObjectURL(file));
  };

  const openPublisherModal = (p = null) => {
    if (p) {
      setEditingPublisherId(p._id);
      setPublisherForm({
        name: p.name || "",
        code: p.code || "",
        phone: p.phone || "",
        email: p.email || "",
        address: p.address || "",
        website: p.website || "",
        description: p.description || "",
        status: p.status || "active",
      });
    } else {
      setEditingPublisherId(null);
      setPublisherForm(emptyPublisher);
    }
    setModal("publisher");
  };

  const openSupplierModal = (s = null) => {
    if (s) {
      setEditingSupplierId(s._id);
      setSupplierForm({
        name: s.name || "",
        contactPerson: s.contactPerson || "",
        phone: s.phone || "",
        email: s.email || "",
        address: s.address || "",
        taxCode: s.taxCode || "",
        website: s.website || "",
        note: s.note || "",
        status: s.status || "active",
      });
    } else {
      setEditingSupplierId(null);
      setSupplierForm(emptySupplier);
    }
    setModal("supplier");
  };

  const openCategoryModal = (c = null, parentHint = null) => {
    if (c) {
      setEditingCategoryId(c._id);
      setCategoryForm({
        name: c.name || "",
        slug: c.slug || "",
        description: c.description || "",
        sortOrder: String(c.sortOrder ?? 0),
        status: c.status || "active",
        parentId: c.parentId ? String(c.parentId) : "",
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm({
        ...emptyCategory,
        parentId: parentHint ? String(parentHint._id) : "",
      });
    }
    setModal("category");
  };

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const childrenOf = useCallback(
    (parentId) =>
      categories.filter(
        (c) =>
          c.status === "active" &&
          (parentId ? String(c.parentId) === String(parentId) : !c.parentId)
      ),
    [categories]
  );

  const applyCascade = (prev, level, id) => {
    const next = { ...prev };
    if (level === 1) {
      next.catL1 = id;
      next.catL2 = "";
      next.catL3 = "";
      next.categoryId = "";
      next.category = "";
    } else if (level === 2) {
      next.catL2 = id;
      next.catL3 = "";
      next.categoryId = "";
      next.category = "";
    } else {
      next.catL3 = id;
      const leaf = categories.find((c) => String(c._id) === String(id));
      next.categoryId = id;
      next.category = leaf?.name || "";
    }
    return next;
  };

  const mergeNode = useCallback((node) => {
    if (!node?.index) return;
    setLedgerNodes((prev) => {
      const idx = prev.findIndex((n) => n.index === node.index);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...node };
        return next;
      }
      return [...prev, node].sort((a, b) => a.index - b.index);
    });
    setHighlightIdx(node.index);
    window.setTimeout(() => setHighlightIdx((h) => (h === node.index ? null : h)), 4000);
  }, []);

  useLedgerLive({
    enabled: !!user && canAccessAdmin(user.role) && hasScope(user.role, "ledger"),
    onHello: () => setLiveOn(true),
    onTx: ({ node, tip }) => {
      setLiveOn(true);
      if (tip) setLedgerTip(tip);
      mergeNode(node);
      setLiveFlash(
        `Tx #${node.index} · ${node.action} · ${
          node.action === "Faucet" || node.bookId === 0 ? "Cấp ETH" : `Book #${node.bookId}`
        }`
      );
      setDash((d) =>
        d
          ? {
              ...d,
              stats: {
                ...d.stats,
                transactions: Math.max(d.stats?.transactions || 0, tip?.latestNodeIndex || 0),
              },
              ledger: d.ledger
                ? {
                    ...d.ledger,
                    latestNodeIndex: tip?.latestNodeIndex ?? d.ledger.latestNodeIndex,
                    latestNodeHash: tip?.latestNodeHash ?? d.ledger.latestNodeHash,
                    verified: tip?.verified ?? d.ledger.verified,
                  }
                : d.ledger,
              recentTx: [
                node,
                ...(d.recentTx || []).filter((x) => x.index !== node.index),
              ].slice(0, 8),
            }
          : d
      );
      // auto mở tab giao dịch khi có tx mới (nếu đang overview)
    },
    onTip: (tip) => {
      if (tip) setLedgerTip(tip);
      setLiveOn(true);
    },
    onBook: ({ book }) => {
      if (!book?.bookId) return;
      setBooks((prev) => {
        const i = prev.findIndex((b) => b.bookId === book.bookId);
        if (i < 0) return [...prev, book].sort((a, b) => a.bookId - b.bookId);
        const next = [...prev];
        next[i] = { ...next[i], ...book };
        return next;
      });
    },
  });

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const { data } = await api.get("/suppliers");
      setSuppliers(data.suppliers || []);
      setSuppliersLoaded(true);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!user || !canAccessAdmin(user.role)) return;
    const role = user.role;
    const tasks = [];
    const keys = [];

    if (hasScope(role, "dashboard")) {
      keys.push("dash");
      tasks.push(api.get("/admin/dashboard"));
    }
    if (
      hasScope(role, "books") ||
      hasScope(role, "mint") ||
      hasScope(role, "stock") ||
      hasScope(role, "catalog")
    ) {
      keys.push("books");
      tasks.push(api.get("/books", { params: { includeInactive: "1" } }));
    }
    if (hasScope(role, "users")) {
      keys.push("users");
      tasks.push(api.get("/admin/users"));
    }
    if (hasScope(role, "ledger")) {
      keys.push("ledger");
      tasks.push(api.get("/ledger?limit=50"));
    }
    if (hasScope(role, "catalog") || hasScope(role, "mint")) {
      keys.push("publishers");
      tasks.push(api.get("/publishers"));
      keys.push("categories");
      tasks.push(api.get("/categories?tree=1"));
    }
    if (hasScope(role, "sales")) {
      keys.push("sales");
      tasks.push(api.get("/sales"));
    }

    const results = await Promise.all(
      tasks.map((p) => p.catch((e) => ({ __err: e })))
    );
    results.forEach((res, i) => {
      if (res?.__err) {
        flash(res.__err.response?.data?.message || res.__err.message, "err");
        return;
      }
      const key = keys[i];
      if (key === "dash") setDash(res.data);
      if (key === "books") setBooks(res.data.books || []);
      if (key === "users") setUsers(res.data.users || []);
      if (key === "ledger") {
        setLedgerNodes(res.data.nodes || []);
        setLedgerTip(res.data.tip || null);
      }
      if (key === "publishers") setPublishers(res.data.publishers || []);
      if (key === "categories") setCategories(res.data.categories || []);
      if (key === "sales") setSales(res.data.sales || []);
    });
  }, [user, flash]);

  useEffect(() => {
    if (user && canAccessAdmin(user.role)) {
      loadAll().catch((e) => flash(e.message, "err"));
      setTabState((t) => firstAllowedTab(user.role, t));
    }
  }, [user, loadAll, flash]);

  // Chỉ tải NCC khi bấm tab — tránh chậm loadAll
  useEffect(() => {
    if (
      user &&
      hasScope(user.role, "catalog") &&
      tab === "suppliers" &&
      !suppliersLoaded
    ) {
      loadSuppliers().catch((e) => flash(e.message, "err"));
    }
  }, [user, tab, suppliersLoaded, loadSuppliers, flash]);

  const filteredBooks = useMemo(() => {
    const ranked = books
      .filter((b) => matchesStockFilter(b, bookFilter))
      .map((b) => ({
        b,
        score: bookQ.trim() ? fuzzyScore(
          [
            bookName(b),
            bookAuthors(b),
            b.isbn,
            b.publisher,
            bookCategory(b),
            b.description,
            b.bookId,
          ].join(" "),
          bookQ
        ) : 1,
      }))
      .filter((x) => {
        if (!bookQ.trim()) return true;
        const idRaw = bookQ.trim().replace(/^#/, "");
        if (/^\d+$/.test(idRaw) && Number(x.b.bookId) === Number(idRaw)) return true;
        return x.score > 0;
      });
    if (bookQ.trim()) {
      ranked.sort((a, c) => c.score - a.score || Number(a.b.bookId) - Number(c.b.bookId));
    }
    return ranked.map((x) => x.b);
  }, [books, bookQ, bookFilter]);

  const filteredTx = useMemo(() => {
    return ledgerNodes.filter((n) => {
      if (txAction !== "all" && n.action !== txAction) return false;
      const q = txBookQ.trim();
      if (q && String(n.bookId) !== q && !String(n.bookId).includes(q)) return false;
      return true;
    });
  }, [ledgerNodes, txAction, txBookQ]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (supplierFilter !== "all" && s.status !== supplierFilter) return false;
      const q = supplierQ.trim().toLowerCase();
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.contactPerson || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q) ||
        (s.taxCode || "").toLowerCase().includes(q) ||
        (s.note || "").toLowerCase().includes(q) ||
        String(s._id || "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, supplierQ, supplierFilter]);

  const filteredPublishers = useMemo(() => {
    return publishers.filter((p) => {
      if (publisherFilter !== "all" && p.status !== publisherFilter) return false;
      const q = publisherQ.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.code || "").toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        (p.website || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        String(p._id || "").toLowerCase().includes(q)
      );
    });
  }, [publishers, publisherQ, publisherFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
      const q = userQ.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.walletAddress || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q) ||
        String(u.id || u._id || "").toLowerCase().includes(q)
      );
    });
  }, [users, userQ, userRoleFilter]);

  const activePublishers = useMemo(
    () => publishers.filter((p) => p.status === "active"),
    [publishers]
  );

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (categoryFilter !== "all" && c.status !== categoryFilter) return false;
      const q = categoryQ.trim().toLowerCase();
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.pathNames || "").toLowerCase().includes(q) ||
        String(c._id || "").toLowerCase().includes(q)
      );
    });
  }, [categories, categoryQ, categoryFilter]);

  const displayCategoryTree = useMemo(() => {
    const matchIds = new Set(filteredCategories.map((c) => String(c._id)));
    if (!categoryQ.trim() && categoryFilter === "all") return categoryTree;
    const byId = new Map(categories.map((c) => [String(c._id), c]));
    const keep = new Set(matchIds);
    for (const id of matchIds) {
      let cur = byId.get(id);
      while (cur?.parentId) {
        keep.add(String(cur.parentId));
        cur = byId.get(String(cur.parentId));
      }
    }
    return buildCategoryTree(categories.filter((c) => keep.has(String(c._id))));
  }, [categoryTree, filteredCategories, categories, categoryQ, categoryFilter]);

  const bookCountByCategory = useMemo(() => {
    const map = new Map();
    for (const b of books) {
      const id = b.categoryId ? String(b.categoryId) : "";
      if (id) map.set(id, (map.get(id) || 0) + 1);
      else if (b.category) {
        const key = `name:${b.category}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [books]);

  // Mặc định mở cấp 1; khi tìm kiếm thì mở mọi ancestor khớp
  useEffect(() => {
    if (!categories.length) return;
    const q = categoryQ.trim().toLowerCase();
    if (!q) {
      setCatExpanded((prev) => {
        const next = new Set(prev);
        for (const c of categories) {
          if ((c.level || 1) === 1) next.add(String(c._id));
        }
        return next;
      });
      return;
    }
    const byId = new Map(categories.map((c) => [String(c._id), c]));
    const expand = new Set();
    for (const c of filteredCategories) {
      let cur = c;
      while (cur) {
        expand.add(String(cur._id));
        cur = cur.parentId ? byId.get(String(cur.parentId)) : null;
      }
    }
    setCatExpanded(expand);
  }, [categories, categoryQ, filteredCategories]);

  const toggleCatExpand = useCallback((id) => {
    const key = String(id);
    setCatExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAllCats = useCallback(() => {
    setCatExpanded(new Set(categories.map((c) => String(c._id))));
  }, [categories]);

  const collapseAllCats = useCallback(() => {
    setCatExpanded(new Set());
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (saleFilter !== "all" && s.status !== saleFilter) return false;
      const q = saleQ.trim().toLowerCase();
      if (!q) return true;
      const itemNames = (s.items || []).map((i) => i.name).join(" ");
      return (
        (s.invoiceNumber || "").toLowerCase().includes(q) ||
        (s.buyer?.name || "").toLowerCase().includes(q) ||
        (s.buyer?.walletAddress || "").toLowerCase().includes(q) ||
        (s.blockchain?.txHash || "").toLowerCase().includes(q) ||
        itemNames.toLowerCase().includes(q) ||
        String(s.blockchain?.txNodeIndex || "").includes(q)
      );
    });
  }, [sales, saleQ, saleFilter]);

  const loadDeployerBalance = useCallback(async () => {
    try {
      const probe =
        (faucetAddr && faucetAddr.startsWith("0x") && faucetAddr.length >= 42
          ? faucetAddr
          : null) ||
        users.find((u) => u.walletAddress)?.walletAddress ||
        "0xd18624683f144a400317Fc7ec8437a8deDeEE906";
      const { data } = await api.get(`/wallet/balance/${probe}`);
      setDeployerInfo(data.deployer || null);
    } catch {
      /* ignore */
    }
  }, [faucetAddr, users]);

  const loadStockMovements = useCallback(async (bookId) => {
    const q = bookId ? `?bookId=${bookId}&limit=80` : "?limit=80";
    const { data } = await api.get(`/stock/movements${q}`);
    setStockMovements(data.movements || []);
  }, []);

  // Hooks phải luôn chạy trước mọi early-return (F5: loading=true rồi mới có user).
  useEffect(() => {
    if (tab === "faucet" && user && hasScope(user.role, "faucet")) {
      loadDeployerBalance();
    }
  }, [tab, user, loadDeployerBalance]);

  useEffect(() => {
    if (user && hasScope(user.role, "stock") && tab === "books") {
      loadStockMovements().catch((e) => flash(e.message, "err"));
    }
  }, [user, tab, loadStockMovements, flash]);

  useEffect(() => {
    if (!modal && !pdfPreview && !viewSale) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) {
        if (pdfPreview) {
          closePdfPreview();
          return;
        }
        if (viewSale) {
          setViewSale(null);
          return;
        }
        setModal(null);
        setEditingId(null);
        setEditingSupplierId(null);
        setEditingCategoryId(null);
        setEditingPublisherId(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [modal, busy, pdfPreview, viewSale]);

  if (loading) {
    return (
      <div className="admin">
        <div className="admin-main muted">Đang tải admin…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAdmin(user.role)) return <Navigate to="/" replace />;

  async function onResync() {
    beginBusy("Đang resync chuỗi…");
    try {
      const { data } = await api.post("/admin/resync");
      flash(`Resync OK · tip #${data.tip?.latestNodeIndex ?? "—"}`);
      await loadAll();
    } catch (e) {
      flash(e.response?.data?.message || e.message, "err");
    } finally {
      endBusy();
    }
  }

  async function onRefreshBooks() {
    beginBusy("Đang sync kho sách…");
    try {
      const { data } = await api.post("/admin/refresh-books");
      flash(`Đã refresh ${data.refreshed}/${data.total} sách từ chain`);
      await loadAll();
    } catch (e) {
      flash(e.response?.data?.message || e.message, "err");
    } finally {
      endBusy();
    }
  }

  async function onMint(e) {
    e.preventDefault();
    beginBusy("Đang mint NFT + lưu file…");
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("authors", form.authors.trim());
      if (form.categoryId) fd.append("categoryId", form.categoryId);
      fd.append("category", form.category || "");
      fd.append("isbn", form.isbn || "");
      if (form.publisherId) fd.append("publisherId", form.publisherId);
      fd.append("publisher", form.publisher || "");
      fd.append("publishYear", form.publishYear || "");
      fd.append("price", form.price || "0");
      fd.append("priceEth", form.price || "0");
      fd.append("quantity", form.quantity || "1");
      fd.append("description", form.description || "");
      fd.append("image", form.image || "");
      fd.append("status", form.status || "available");
      if (form.to?.trim()) fd.append("to", form.to.trim());
      if (mintFile) fd.append("bookFile", mintFile);
      if (mintCover) fd.append("coverImage", mintCover);

      const { data } = await api.post("/books/admin/mint", fd);
      const newId = data.book?.bookId;
      const l2 = data.layer2?.contentHash
        ? ` · L2 sha256:${shortHash(data.layer2.contentHash)}`
        : "";
      flash(
        `Mint thành công · book #${newId ?? "?"} · ${String(data.txHash || "").slice(0, 18)}…${l2}`
      );
      setForm(emptyMint);
      setMintFile(null);
      if (mintCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(mintCoverPreview);
      setMintCover(null);
      setMintCoverPreview("");
      setModal(null);
      if (newId) {
        setHighlightBookId(newId);
        window.setTimeout(() => setHighlightBookId((h) => (h === newId ? null : h)), 4500);
      }
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function downloadBookFile(bookId, fileName) {
    beginBusy("Đang tải file sách…");
    try {
      const { data, headers } = await api.get(`/books/${bookId}/file`, {
        responseType: "blob",
      });
      const blob = new Blob([data], {
        type: headers["content-type"] || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `book-${bookId}`;
      a.click();
      URL.revokeObjectURL(url);
      flash(`Đã tải file sách #${bookId}`);
    } catch (err) {
      let message = err.message;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          message = JSON.parse(text)?.message || text;
        } catch {
          /* ignore */
        }
      } else {
        message = err.response?.data?.message || message;
      }
      flash(message, "err");
    } finally {
      endBusy();
    }
  }

  const openStockInModal = (book = null) => {
    const b = book || null;
    setStockInForm({
      bookId: b?.bookId != null ? String(b.bookId) : "",
      quantity: "1",
      unitPrice:
        b?.costPrice > 0
          ? String(b.costPrice)
          : b?.price != null
            ? String(b.price)
            : "0.02",
      supplierId: "",
      note: "",
    });
    if (!suppliersLoaded) loadSuppliers().catch(() => {});
    setModal("stock-in");
  };

  async function submitStockIn(e) {
    e?.preventDefault?.();
    const bookId = Number(stockInForm.bookId);
    const quantity = Number(stockInForm.quantity);
    const unitPrice = Number(stockInForm.unitPrice);
    if (!bookId) {
      flash("Chọn sách cần nhập kho", "err");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      flash("Số lượng nhập phải > 0", "err");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      flash("Giá nhập (ETH) không hợp lệ", "err");
      return;
    }
    beginBusy("Đang nhập kho…");
    let createdMovement = null;
    try {
      const { data } = await api.post("/stock/in", {
        bookId,
        quantity,
        unitPrice,
        supplierId: stockInForm.supplierId || undefined,
        note: stockInForm.note?.trim() || undefined,
      });
      flash(data.message || `Đã nhập kho +${quantity} · #${bookId}`);
      setModal(null);
      setHighlightBookId(bookId);
      window.setTimeout(
        () => setHighlightBookId((h) => (h === bookId ? null : h)),
        3500
      );
      await loadAll();
      await loadStockMovements();
      createdMovement = data.movement || null;
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
    if (createdMovement?._id || createdMovement?.voucherNumber) {
      viewStockPdf(createdMovement).catch(() => {});
    }
  }

  async function updateStockQuantity(book, nextQty) {
    if (!book?.bookId) return;
    const qty = Math.max(0, Math.floor(Number(nextQty)));
    if (!Number.isFinite(qty)) {
      flash("Số lượng tồn không hợp lệ", "err");
      return;
    }
    beginBusy(`Đang điều chỉnh tồn #${book.bookId}…`);
    try {
      const { data } = await api.post("/stock/adjust", {
        bookId: book.bookId,
        quantity: qty,
        note: "Điều chỉnh tồn trên bảng kho",
      });
      flash(data.message || `Tồn #${book.bookId} → ${qty}`);
      setHighlightBookId(book.bookId);
      window.setTimeout(
        () => setHighlightBookId((h) => (h === book.bookId ? null : h)),
        3500
      );
      await loadAll();
      await loadStockMovements();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function saveMeta(e) {
    e?.preventDefault?.();
    if (!editingId) return;
    beginBusy("Đang lưu tồn & thông tin sách…");
    try {
      const fd = new FormData();
      fd.append("name", editMeta.name.trim());
      fd.append("authors", editMeta.authors.trim());
      if (editMeta.categoryId) fd.append("categoryId", editMeta.categoryId);
      fd.append("category", editMeta.category || "");
      fd.append("isbn", editMeta.isbn || "");
      if (editMeta.publisherId) fd.append("publisherId", editMeta.publisherId);
      fd.append("publisher", editMeta.publisher || "");
      fd.append("publishYear", editMeta.publishYear || "");
      fd.append("price", editMeta.price || "0");
      fd.append("quantity", editMeta.quantity || "1");
      fd.append("description", editMeta.description || "");
      fd.append("image", editMeta.image || "");
      fd.append("status", editMeta.status || "available");
      if (editFile) fd.append("bookFile", editFile);
      if (editCover) fd.append("coverImage", editCover);

      const { data } = await api.patch(`/books/${editingId}/meta`, fd);
      const l2 = data.layer2?.contentHash
        ? ` · file L2 sha256:${shortHash(data.layer2.contentHash)}`
        : "";
      const coverHint = editCover ? " · đã cập nhật ảnh bìa" : "";
      flash(`Đã cập nhật sách #${editingId}${l2}${coverHint}`);
      if (editCoverPreview?.startsWith("blob:")) URL.revokeObjectURL(editCoverPreview);
      setModal(null);
      setEditingId(null);
      setEditFile(null);
      setEditCover(null);
      setEditCoverPreview("");
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  /** Soft-delete (ngừng KD). hard=true → xóa document Mongo. */
  async function removeBook(book, { hard = false } = {}) {
    if (!book?.bookId) return;
    const name = bookName(book);
    const ok = window.confirm(
      hard
        ? `Xóa cứng catalog #${book.bookId} «${name}»?\nNFT on-chain vẫn còn — không hoàn tác được.`
        : `Ngừng kinh doanh #${book.bookId} «${name}»?\nSách ẩn khỏi sàn; có thể khôi phục sau.`
    );
    if (!ok) return;
    beginBusy(hard ? "Đang xóa cứng…" : "Đang ngừng KD…");
    try {
      const { data } = await api.delete(`/books/${book.bookId}`, {
        params: hard ? { hard: "1" } : undefined,
      });
      flash(data.message || `Đã xử lý #${book.bookId}`);
      if (modal === "edit" && Number(editingId) === Number(book.bookId)) {
        setModal(null);
        setEditingId(null);
      }
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function restoreBook(book) {
    if (!book?.bookId) return;
    beginBusy("Đang khôi phục sách…");
    try {
      const { data } = await api.post(`/books/${book.bookId}/restore`);
      flash(data.message || `Đã khôi phục #${book.bookId}`);
      setHighlightBookId(book.bookId);
      window.setTimeout(
        () => setHighlightBookId((h) => (h === book.bookId ? null : h)),
        3500
      );
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function saveSupplier(e) {
    e.preventDefault();
    beginBusy("Đang lưu nhà cung cấp…");
    try {
      const payload = {
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim(),
        phone: supplierForm.phone.trim(),
        email: supplierForm.email.trim(),
        address: supplierForm.address.trim(),
        taxCode: supplierForm.taxCode.trim(),
        website: supplierForm.website.trim(),
        note: supplierForm.note.trim(),
        status: supplierForm.status || "active",
      };
      if (editingSupplierId) {
        await api.patch(`/suppliers/${editingSupplierId}`, payload);
        flash(`Đã cập nhật NCC «${payload.name}»`);
      } else {
        await api.post("/suppliers", payload);
        flash(`Đã thêm NCC «${payload.name}»`);
      }
      setModal(null);
      setEditingSupplierId(null);
      setSupplierForm(emptySupplier);
      await Promise.all([loadSuppliers(), loadAll()]);
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function removeSupplier(id, name) {
    if (!window.confirm(`Xóa nhà cung cấp «${name}»?`)) return;
    beginBusy("Đang xóa nhà cung cấp…");
    try {
      await api.delete(`/suppliers/${id}`);
      flash(`Đã xóa NCC «${name}»`);
      await Promise.all([loadSuppliers(), loadAll()]);
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function savePublisher(e) {
    e.preventDefault();
    beginBusy("Đang lưu nhà xuất bản…");
    try {
      const payload = {
        name: publisherForm.name.trim(),
        code: publisherForm.code.trim(),
        phone: publisherForm.phone.trim(),
        email: publisherForm.email.trim(),
        address: publisherForm.address.trim(),
        website: publisherForm.website.trim(),
        description: publisherForm.description.trim(),
        status: publisherForm.status || "active",
      };
      if (editingPublisherId) {
        await api.patch(`/publishers/${editingPublisherId}`, payload);
        flash(`Đã cập nhật NXB «${payload.name}»`);
      } else {
        await api.post("/publishers", payload);
        flash(`Đã thêm NXB «${payload.name}»`);
      }
      setModal(null);
      setEditingPublisherId(null);
      setPublisherForm(emptyPublisher);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function removePublisher(id, name) {
    if (!window.confirm(`Xóa nhà xuất bản «${name}»?`)) return;
    beginBusy("Đang xóa nhà xuất bản…");
    try {
      await api.delete(`/publishers/${id}`);
      flash(`Đã xóa NXB «${name}»`);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  function applyPublisherSelect(prev, publisherId) {
    const pub = publishers.find((p) => String(p._id) === String(publisherId));
    return {
      ...prev,
      publisherId: publisherId || "",
      publisher: pub?.name || "",
    };
  }

  async function saveCategory(e) {
    e.preventDefault();
    beginBusy("Đang lưu danh mục…");
    try {
      const payload = {
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim(),
        description: categoryForm.description.trim(),
        sortOrder: Number(categoryForm.sortOrder) || 0,
        status: categoryForm.status || "active",
        parentId: categoryForm.parentId || null,
      };
      if (editingCategoryId) {
        await api.patch(`/categories/${editingCategoryId}`, payload);
        flash(`Đã cập nhật danh mục «${payload.name}»`);
      } else {
        await api.post("/categories", payload);
        flash(`Đã thêm danh mục «${payload.name}»`);
      }
      setModal(null);
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function removeCategory(id, name) {
    if (!window.confirm(`Xóa danh mục «${name}»?`)) return;
    beginBusy("Đang xóa danh mục…");
    try {
      await api.delete(`/categories/${id}`);
      flash(`Đã xóa danh mục «${name}»`);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function backfillSales() {
    beginBusy("Đang đồng bộ hóa đơn…");
    try {
      const { data } = await api.post("/sales/backfill", { limit: 200 });
      flash(`Xuất/đồng bộ ${data.issued}/${data.total} hóa đơn từ TxNode Sale`);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function cancelSaleInvoice(id, number) {
    const reason = window.prompt(`Lý do hủy hóa đơn ${number}?`, "Hủy bởi admin") || "";
    if (!reason.trim()) return;
    beginBusy("Đang hủy hóa đơn…");
    try {
      await api.post(`/sales/${id}/cancel`, { reason });
      flash(`Đã hủy HĐ ${number}`);
      setViewSale(null);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function blobErrorMessage(err, fallback) {
    let message = fallback || err.message;
    if (err.response?.data instanceof Blob) {
      try {
        message = JSON.parse(await err.response.data.text())?.message || message;
      } catch {
        /* ignore */
      }
    } else {
      message = err.response?.data?.message || message;
    }
    return message;
  }

  async function fetchSalePdfBlob(sale, { view = false } = {}) {
    const key = sale._id || sale.invoiceNumber;
    const { data } = await api.get(`/sales/${key}/pdf`, {
      responseType: "blob",
      params: view ? { view: 1 } : undefined,
    });
    return new Blob([data], { type: "application/pdf" });
  }

  async function fetchStockPdfBlob(movement, { view = false } = {}) {
    const key = movement._id || movement.voucherNumber;
    const { data } = await api.get(`/stock/movements/${key}/pdf`, {
      responseType: "blob",
      params: view ? { view: 1 } : undefined,
    });
    return new Blob([data], { type: "application/pdf" });
  }

  function closePdfPreview() {
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  async function viewSalePdf(sale) {
    if (!sale?._id && !sale?.invoiceNumber) return;
    beginBusy("Đang mở PDF hóa đơn…");
    try {
      const blob = await fetchSalePdfBlob(sale, { view: true });
      const url = URL.createObjectURL(blob);
      setPdfPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          title: sale.invoiceNumber || "Hóa đơn",
          kind: "sale",
          sale,
          downloadName: `${sale.invoiceNumber || "hoadon"}.pdf`,
        };
      });
    } catch (err) {
      flash(await blobErrorMessage(err), "err");
    } finally {
      endBusy();
    }
  }

  async function downloadSalePdf(sale) {
    if (!sale?._id && !sale?.invoiceNumber) return;
    beginBusy("Đang tải PDF hóa đơn…");
    try {
      const blob = await fetchSalePdfBlob(sale);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sale.invoiceNumber || "hoadon"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      flash(`Đã tải PDF ${sale.invoiceNumber}`);
    } catch (err) {
      flash(await blobErrorMessage(err), "err");
    } finally {
      endBusy();
    }
  }

  async function viewStockPdf(movement) {
    if (!movement?._id && !movement?.voucherNumber) return;
    beginBusy("Đang mở phiếu kho PDF…");
    try {
      const blob = await fetchStockPdfBlob(movement, { view: true });
      const url = URL.createObjectURL(blob);
      const title = movement.voucherNumber || "Phiếu kho";
      setPdfPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          title,
          kind: "stock",
          movement,
          downloadName: `${title}.pdf`,
        };
      });
    } catch (err) {
      flash(await blobErrorMessage(err), "err");
    } finally {
      endBusy();
    }
  }

  async function downloadStockPdf(movement) {
    if (!movement?._id && !movement?.voucherNumber) return;
    beginBusy("Đang tải phiếu kho PDF…");
    try {
      const blob = await fetchStockPdfBlob(movement);
      const url = URL.createObjectURL(blob);
      const name = `${movement.voucherNumber || "phieu-kho"}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      flash(`Đã tải PDF ${movement.voucherNumber || "phiếu kho"}`);
    } catch (err) {
      flash(await blobErrorMessage(err), "err");
    } finally {
      endBusy();
    }
  }

  async function downloadPdfPreview() {
    if (!pdfPreview) return;
    if (pdfPreview.kind === "stock" && pdfPreview.movement) {
      return downloadStockPdf(pdfPreview.movement);
    }
    if (pdfPreview.sale) return downloadSalePdf(pdfPreview.sale);
  }

  async function refreshOne(bookId) {
    beginBusy(`Đang sync sách #${bookId}…`);
    try {
      await api.post(`/books/${bookId}/refresh`);
      flash(`Đã sync book #${bookId} từ chain`);
      await loadAll();
    } catch (e) {
      flash(e.response?.data?.message || e.message, "err");
    } finally {
      endBusy();
    }
  }

  async function saveUser(e) {
    e.preventDefault();
    const name = userForm.name.trim();
    const email = userForm.email.trim().toLowerCase();
    if (!name || !email) {
      flash("Thiếu tên hoặc email", "err");
      return;
    }
    if (!editingUserId) {
      if ((userForm.password || "").length < 6) {
        flash("Mật khẩu tối thiểu 6 ký tự", "err");
        return;
      }
      if (userForm.password !== userForm.passwordConfirm) {
        flash("Xác nhận mật khẩu không khớp", "err");
        return;
      }
    }
    beginBusy(editingUserId ? "Đang cập nhật tài khoản…" : "Đang tạo tài khoản…");
    try {
      if (editingUserId) {
        await api.patch(`/admin/users/${editingUserId}`, {
          name,
          email,
          role: userForm.role || "user",
          walletAddress: (userForm.walletAddress || "").trim(),
        });
        flash(`Đã cập nhật «${name}»`);
      } else {
        await api.post("/admin/users", {
          name,
          email,
          role: userForm.role || "user",
          walletAddress: (userForm.walletAddress || "").trim(),
          password: userForm.password,
        });
        flash(`Đã tạo tài khoản «${name}»`);
      }
      setModal(null);
      setEditingUserId(null);
      setUserForm(emptyUserForm);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function saveUserPassword(e) {
    e.preventDefault();
    const uid = passwordUser?.id || passwordUser?._id;
    if (!uid) return;
    if ((passwordForm.password || "").length < 6) {
      flash("Mật khẩu tối thiểu 6 ký tự", "err");
      return;
    }
    if (passwordForm.password !== passwordForm.passwordConfirm) {
      flash("Xác nhận mật khẩu không khớp", "err");
      return;
    }
    beginBusy("Đang đổi mật khẩu…");
    try {
      await api.patch(`/admin/users/${uid}/password`, {
        password: passwordForm.password,
      });
      flash(`Đã đổi mật khẩu cho «${passwordUser?.name || passwordUser?.email}»`);
      setModal(null);
      setPasswordUser(null);
      setPasswordForm(emptyPasswordForm);
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function removeUser(id, name) {
    if (!window.confirm(`Xóa tài khoản «${name}»? Thao tác không hoàn tác.`)) return;
    beginBusy("Đang xóa tài khoản…");
    try {
      await api.delete(`/admin/users/${id}`);
      flash(`Đã xóa «${name}»`);
      await loadAll();
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function sendAdminFaucet(payload) {
    beginBusy("Đang cấp ETH…");
    try {
      const { data } = await api.post("/admin/faucet", payload);
      setFaucetResults(data.results || []);
      if (data.deployerBalanceEth) {
        setDeployerInfo((d) => ({
          ...(d || {}),
          balanceEth: data.deployerBalanceEth,
        }));
      }
      const nodes = (data.results || []).filter((r) => r.nodeIndex).map((r) => r.nodeIndex);
      flash(
        `Cấp ETH xong · gửi ${data.funded}, bỏ qua ${data.skipped}, lỗi ${data.failed}` +
          (nodes.length ? ` · TxNode #${nodes.join(", #")}` : "")
      );
    } catch (err) {
      flash(err.response?.data?.message || err.message, "err");
    } finally {
      endBusy();
    }
  }

  async function sendFaucetSingle(e) {
    e.preventDefault();
    await sendAdminFaucet({
      address: faucetAddr.trim(),
      amountEth: faucetAmount,
      force: faucetForce,
    });
  }

  async function sendFaucetBatch(e) {
    e.preventDefault();
    await sendAdminFaucet({
      text: faucetBatch,
      amountEth: faucetAmount,
      force: faucetForce,
    });
  }

  async function fundUserWallet(walletAddress) {
    if (!walletAddress) {
      flash("User chưa gắn ví", "err");
      return;
    }
    await sendAdminFaucet({
      address: walletAddress,
      amountEth: faucetAmount || "1",
      force: true,
    });
  }



  const ledger = dash?.ledger;

  const adminCtx = {
    tab,
    setTab,
    dash,
    books,
    setBooks,
    users,
    suppliers,
    publishers,
    ledgerNodes,
    ledgerTip,
    toasts,
    busy,
    busyLabel,
    sideCollapsed,
    darkMode,
    toggleDark,
    form,
    setForm,
    bookQ,
    setBookQ,
    bookFilter,
    setBookFilter,
    modal,
    setModal,
    editingId,
    editMeta,
    setEditMeta,
    mintFile,
    setMintFile,
    mintCover,
    mintCoverPreview,
    onMintCoverPick,
    editFile,
    setEditFile,
    editCover,
    setEditCover,
    editCoverPreview,
    setEditCoverPreview,
    editHasFile,
    editFileName,
    highlightBookId,
    supplierQ,
    setSupplierQ,
    supplierFilter,
    setSupplierFilter,
    supplierForm,
    setSupplierForm,
    editingSupplierId,
    publisherQ,
    setPublisherQ,
    publisherFilter,
    setPublisherFilter,
    publisherForm,
    setPublisherForm,
    editingPublisherId,
    suppliersLoaded,
    suppliersLoading,
    categories,
    categoryQ,
    setCategoryQ,
    categoryFilter,
    setCategoryFilter,
    categoryForm,
    setCategoryForm,
    editingCategoryId,
    catExpanded,
    setCatExpanded,
    sales,
    saleQ,
    setSaleQ,
    saleFilter,
    setSaleFilter,
    viewSale,
    setViewSale,
    pdfPreview,
    setPdfPreview,
    faucetAddr,
    setFaucetAddr,
    faucetAmount,
    setFaucetAmount,
    faucetBatch,
    setFaucetBatch,
    faucetForce,
    setFaucetForce,
    faucetResults,
    deployerInfo,
    liveOn,
    liveFlash,
    txAction,
    setTxAction,
    txBookQ,
    setTxBookQ,
    highlightIdx,
    setHighlightIdx,
    viewMode,
    setViewMode,
    bookView,
    setBookViewMode,
    dismissToast,
    flash,
    beginBusy,
    endBusy,
    toggleSide,
    openMintModal,
    openEditModal,
    closeModal,
    closePdfPreview,
    onMint,
    onRefreshBooks,
    onResync,
    downloadBookFile,
    refreshOne,
    updateStockQuantity,
    stockMovements,
    stockInForm,
    setStockInForm,
    openStockInModal,
    submitStockIn,
    loadStockMovements,
    saveMeta,
    removeBook,
    restoreBook,
    onEditCoverPick,
    loadSuppliers,
    openSupplierModal,
    saveSupplier,
    removeSupplier,
    openPublisherModal,
    savePublisher,
    removePublisher,
    openCategoryModal,
    saveCategory,
    removeCategory,
    toggleCatExpand,
    expandAllCats,
    collapseAllCats,
    childrenOf,
    applyCascade,
    applyPublisherSelect,
    filteredBooks,
    filteredSuppliers,
    filteredPublishers,
    filteredUsers,
    filteredCategories,
    filteredSales,
    filteredTx,
    categoryTree,
    displayCategoryTree,
    bookCountByCategory,
    activePublishers,
    userQ,
    setUserQ,
    userRoleFilter,
    setUserRoleFilter,
    userForm,
    setUserForm,
    editingUserId,
    passwordForm,
    setPasswordForm,
    passwordUser,
    openUserModal,
    openUserPasswordModal,
    saveUser,
    saveUserPassword,
    removeUser,
    user,
    logout,
    fundUserWallet,
    sendFaucetSingle,
    sendFaucetBatch,
    sendAdminFaucet,
    loadDeployerBalance,
    downloadSalePdf,
    viewSalePdf,
    downloadStockPdf,
    viewStockPdf,
    downloadPdfPreview,
    cancelSaleInvoice,
    backfillSales,
    fetchSalePdfBlob,
    fetchStockPdfBlob,
    mergeNode,
    ledger,
  };

  return (
    <AdminProvider value={adminCtx}>
      <div
        className={`admin${sideCollapsed ? " is-side-collapsed" : ""}${
          darkMode ? " is-dark" : ""
        }`}
      >
        <AdminSidebar />
        <div className="admin-main">
          <AdminHeader />

          {liveFlash && (
            <div className="toast ok live-toast">
              <Radio size={14} /> Live · {liveFlash}
            </div>
          )}

          {tab === "overview" && canAccessTab(user.role, "overview") && (
            <OverviewTab />
          )}
          {tab === "mint" && canAccessTab(user.role, "mint") && <MintTab />}
          {tab === "books" && canAccessTab(user.role, "books") && <BooksTab />}
          {tab === "ledger" && canAccessTab(user.role, "ledger") && (
            <LedgerTab />
          )}
          {tab === "faucet" && canAccessTab(user.role, "faucet") && (
            <FaucetTab />
          )}
          {tab === "sales" && canAccessTab(user.role, "sales") && <SalesTab />}
          {tab === "categories" && canAccessTab(user.role, "categories") && (
            <CategoriesTab />
          )}
          {tab === "publishers" && canAccessTab(user.role, "publishers") && (
            <PublishersTab />
          )}
          {tab === "suppliers" && canAccessTab(user.role, "suppliers") && (
            <SuppliersTab />
          )}
          {tab === "users" && canAccessTab(user.role, "users") && <UsersTab />}
          {tab === "system" && canAccessTab(user.role, "system") && (
            <SystemTab />
          )}

          {modal === "mint" && <MintModal />}
          {modal === "edit" && <EditBookModal />}
          {pdfPreview && <PdfPreviewModal />}
          {viewSale && <InvoiceModal />}
          {modal === "category" && <CategoryModal />}
          {modal === "publisher" && <PublisherModal />}
          {modal === "supplier" && <SupplierModal />}
          {modal === "stock-in" && <StockInModal />}
          {modal === "user" && <UserModal />}
          {modal === "user-password" && <UserPasswordModal />}
        </div>

        <BusyOverlay />
        <ToastHost />
      </div>
    </AdminProvider>
  );
}
