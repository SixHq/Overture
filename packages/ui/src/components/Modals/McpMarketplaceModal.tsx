import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Star, Download, ExternalLink, Server,
  ArrowLeft, Key, Sparkles, Clock, Tag, Github, Zap,
  Grid3X3, List, ChevronRight, CheckCircle2
} from 'lucide-react';
import { usePlanStore, McpServer } from '@/stores/plan-store';
import { clsx } from 'clsx';

// Use local proxy to avoid CORS issues
const MCP_MARKETPLACE_URL = '/api/mcp-marketplace';

type SortOption = 'recommended' | 'stars' | 'downloads' | 'name' | 'recent';
type CategoryFilter = 'all' | string;
type ViewMode = 'grid' | 'list';

interface McpMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  planId?: string;
  currentMcps?: McpServer[];
}

// Category icons/colors mapping
const categoryStyles: Record<string, { color: string; bg: string }> = {
  'browser-automation': { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'cloud-platforms': { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  'image-video-processing': { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  'database': { color: 'text-green-400', bg: 'bg-green-500/10' },
  'development-tools': { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  'communication': { color: 'text-pink-400', bg: 'bg-pink-500/10' },
  'default': { color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

export function McpMarketplaceModal({ isOpen, onClose, nodeId, planId, currentMcps }: McpMarketplaceModalProps) {
  const { addNodeMcpServer, addMcpServerToAllNodes } = usePlanStore();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showDetail, setShowDetail] = useState(false);
  const [usageDescription, setUsageDescription] = useState('');
  const [attachToAllNodes, setAttachToAllNodes] = useState(false);

  // Fetch MCP servers
  useEffect(() => {
    if (!isOpen) return;

    const fetchServers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(MCP_MARKETPLACE_URL);
        if (!response.ok) throw new Error('Failed to fetch MCP servers');
        const data = await response.json();
        setServers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load MCP marketplace');
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedServer(null);
      setShowDetail(false);
      setUsageDescription('');
      setAttachToAllNodes(false);
    }
  }, [isOpen]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(servers.map(s => s.category));
    return Array.from(cats).sort();
  }, [servers]);

  // Filter and sort servers
  const filteredServers = useMemo(() => {
    let result = [...servers];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query)) ||
        s.author.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(s => s.category === categoryFilter);
    }

    switch (sortBy) {
      case 'recommended':
        result.sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0) || b.githubStars - a.githubStars);
        break;
      case 'stars':
        result.sort((a, b) => b.githubStars - a.githubStars);
        break;
      case 'downloads':
        result.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    return result;
  }, [servers, searchQuery, categoryFilter, sortBy]);

  const handleSelect = useCallback((server: McpServer) => {
    setSelectedServer(server);
    setShowDetail(true);
  }, []);

  const isServerAttached = useCallback((server: McpServer) => {
    return currentMcps?.some(m => m.mcpId === server.mcpId) || false;
  }, [currentMcps]);

  const handleConfirm = useCallback(() => {
    if (selectedServer) {
      // Add usage description to the server object
      const serverWithUsage = {
        ...selectedServer,
        usageDescription: usageDescription.trim() || undefined,
      };
      if (attachToAllNodes) {
        addMcpServerToAllNodes(serverWithUsage as McpServer, planId);
      } else {
        addNodeMcpServer(nodeId, serverWithUsage as McpServer, planId);
      }
    }
    onClose();
  }, [selectedServer, usageDescription, nodeId, planId, attachToAllNodes, addNodeMcpServer, addMcpServerToAllNodes, onClose]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatCategory = (cat: string) => {
    return cat.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getCategoryStyle = (category: string) => {
    return categoryStyles[category] || categoryStyles.default;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Use portal to render modal at document body level, escaping any parent overflow constraints
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-canvas"
        >
          <div className="h-full flex flex-col">
            {/* Top Header Bar */}
            <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-4">
                {showDetail ? (
                  <button
                    onClick={() => setShowDetail(false)}
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">Back to Marketplace</span>
                  </button>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple via-accent-blue to-accent-cyan flex items-center justify-center shadow-lg shadow-accent-purple/20">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-text-primary">MCP Marketplace</h1>
                      <p className="text-xs text-text-muted">Extend your node with powerful integrations</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-surface-raised hover:bg-surface-overlay flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex">
              {!showDetail ? (
                <>
                  {/* Left Sidebar - Categories */}
                  <aside className="w-64 border-r border-border bg-surface/50 p-4 overflow-y-auto shrink-0 hidden lg:block">
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Categories</h3>
                    <nav className="space-y-1">
                      <button
                        onClick={() => setCategoryFilter('all')}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                          categoryFilter === 'all'
                            ? 'bg-accent-blue/10 text-accent-blue font-medium'
                            : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                        )}
                      >
                        All Categories
                        <span className="float-right text-text-muted">{servers.length}</span>
                      </button>
                      {categories.map(cat => {
                        const style = getCategoryStyle(cat);
                        const count = servers.filter(s => s.category === cat).length;
                        return (
                          <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={clsx(
                              'w-full text-left px-3 py-2 rounded-lg text-sm transition-all',
                              categoryFilter === cat
                                ? `${style.bg} ${style.color} font-medium`
                                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                            )}
                          >
                            {formatCategory(cat)}
                            <span className="float-right text-text-muted">{count}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </aside>

                  {/* Main Grid */}
                  <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Search & Filters Bar */}
                    <div className="p-4 border-b border-border bg-surface/30 shrink-0">
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[280px]">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search MCP servers by name, description, or tags..."
                            className="w-full pl-12 pr-4 py-3 bg-canvas border border-border rounded-xl
                                     text-sm text-text-primary placeholder:text-text-muted
                                     focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
                          />
                        </div>

                        {/* Mobile Category Filter */}
                        <select
                          value={categoryFilter}
                          onChange={e => setCategoryFilter(e.target.value)}
                          className="lg:hidden px-4 py-3 bg-canvas border border-border rounded-xl text-sm
                                   text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                        >
                          <option value="all">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{formatCategory(cat)}</option>
                          ))}
                        </select>

                        {/* Sort */}
                        <select
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value as SortOption)}
                          className="px-4 py-3 bg-canvas border border-border rounded-xl text-sm
                                   text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                        >
                          <option value="recommended">Recommended</option>
                          <option value="stars">Most Stars</option>
                          <option value="downloads">Most Downloads</option>
                          <option value="name">Name (A-Z)</option>
                          <option value="recent">Recently Updated</option>
                        </select>

                        {/* View Toggle */}
                        <div className="flex items-center bg-canvas border border-border rounded-xl p-1">
                          <button
                            onClick={() => setViewMode('grid')}
                            className={clsx(
                              'p-2 rounded-lg transition-colors',
                              viewMode === 'grid' ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
                            )}
                          >
                            <Grid3X3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                              'p-2 rounded-lg transition-colors',
                              viewMode === 'list' ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
                            )}
                          >
                            <List className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Results count */}
                      <p className="text-xs text-text-muted mt-3">
                        {filteredServers.length} {filteredServers.length === 1 ? 'server' : 'servers'} found
                      </p>
                    </div>

                    {/* Server Grid/List */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <div className="w-12 h-12 border-3 border-accent-blue border-t-transparent rounded-full animate-spin mb-4" />
                          <p className="text-text-muted">Loading MCP servers...</p>
                        </div>
                      ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <div className="w-16 h-16 rounded-2xl bg-accent-red/10 flex items-center justify-center mb-4">
                            <X className="w-8 h-8 text-accent-red" />
                          </div>
                          <p className="text-accent-red font-medium mb-2">{error}</p>
                          <button
                            onClick={() => window.location.reload()}
                            className="text-sm text-accent-blue hover:underline"
                          >
                            Try again
                          </button>
                        </div>
                      ) : filteredServers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <div className="w-16 h-16 rounded-2xl bg-surface-raised flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-text-muted" />
                          </div>
                          <p className="text-text-primary font-medium mb-1">No servers found</p>
                          <p className="text-text-muted text-sm">Try adjusting your search or filters</p>
                        </div>
                      ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {filteredServers.map((server, index) => (
                            <motion.div
                              key={server.mcpId}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              onClick={() => handleSelect(server)}
                              className={clsx(
                                'group p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200',
                                'hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1',
                                selectedServer?.mcpId === server.mcpId
                                  ? 'border-accent-blue bg-accent-blue/5 shadow-lg shadow-accent-blue/10'
                                  : 'border-border bg-surface hover:border-accent-blue/30'
                              )}
                            >
                              <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-surface-raised to-surface-overlay flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                  {server.logoUrl ? (
                                    <img
                                      src={server.logoUrl}
                                      alt={server.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <Server className={clsx('w-7 h-7 text-text-muted', server.logoUrl && 'hidden')} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-text-primary truncate">{server.name}</h3>
                                    {isServerAttached(server) && (
                                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-accent-green/20 text-accent-green rounded-full flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Attached
                                      </span>
                                    )}
                                    {server.isRecommended && !isServerAttached(server) && (
                                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-accent-yellow to-accent-orange text-white rounded-full flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        Featured
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted mb-2">by {server.author}</p>
                                  <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{server.description}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                                <div className="flex items-center gap-1.5 text-text-muted">
                                  <Star className="w-4 h-4 text-accent-yellow" />
                                  <span className="text-sm font-medium">{formatNumber(server.githubStars)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-text-muted">
                                  <Download className="w-4 h-4 text-accent-green" />
                                  <span className="text-sm font-medium">{formatNumber(server.downloadCount)}</span>
                                </div>
                                {server.requiresApiKey && (
                                  <div className="flex items-center gap-1.5 text-accent-yellow ml-auto">
                                    <Key className="w-4 h-4" />
                                    <span className="text-xs font-medium">API Key</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-3">
                                <span className={clsx(
                                  'text-xs font-medium px-2.5 py-1 rounded-lg',
                                  getCategoryStyle(server.category).bg,
                                  getCategoryStyle(server.category).color
                                )}>
                                  {formatCategory(server.category)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-4 pt-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {server.tags.slice(0, 3).map(tag => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-2 py-0.5 bg-surface-raised rounded-md text-text-muted"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent-blue group-hover:translate-x-1 transition-all" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredServers.map((server, index) => (
                            <motion.div
                              key={server.mcpId}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              onClick={() => handleSelect(server)}
                              className={clsx(
                                'group flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                                'hover:shadow-lg hover:shadow-black/5',
                                selectedServer?.mcpId === server.mcpId
                                  ? 'border-accent-blue bg-accent-blue/5'
                                  : 'border-border bg-surface hover:border-accent-blue/30'
                              )}
                            >
                              <div className="w-12 h-12 rounded-xl bg-surface-raised flex items-center justify-center overflow-hidden shrink-0">
                                {server.logoUrl ? (
                                  <img src={server.logoUrl} alt={server.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Server className="w-6 h-6 text-text-muted" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-text-primary">{server.name}</h3>
                                  {server.isRecommended && (
                                    <Sparkles className="w-4 h-4 text-accent-yellow" />
                                  )}
                                </div>
                                <p className="text-sm text-text-secondary truncate">{server.description}</p>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-text-muted shrink-0">
                                <span className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-accent-yellow" />
                                  {formatNumber(server.githubStars)}
                                </span>
                                <span className={clsx(
                                  'px-2 py-1 rounded-lg text-xs font-medium',
                                  getCategoryStyle(server.category).bg,
                                  getCategoryStyle(server.category).color
                                )}>
                                  {formatCategory(server.category)}
                                </span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </main>
                </>
              ) : selectedServer && (
                /* Detail View */
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-4xl mx-auto p-8">
                    {/* Server Header */}
                    <div className="flex items-start gap-6 mb-8">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-surface-raised to-surface-overlay flex items-center justify-center overflow-hidden shadow-xl">
                        {selectedServer.logoUrl ? (
                          <img src={selectedServer.logoUrl} alt={selectedServer.name} className="w-full h-full object-cover" />
                        ) : (
                          <Server className="w-12 h-12 text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-3xl font-bold text-text-primary">{selectedServer.name}</h2>
                          {selectedServer.isRecommended && (
                            <span className="px-3 py-1 text-sm font-bold bg-gradient-to-r from-accent-yellow to-accent-orange text-white rounded-full flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4" />
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="text-text-muted mb-4">by {selectedServer.author}</p>
                        <p className="text-lg text-text-secondary leading-relaxed">{selectedServer.description}</p>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="p-4 rounded-xl bg-surface border border-border">
                        <div className="flex items-center gap-2 text-text-muted mb-1">
                          <Star className="w-4 h-4 text-accent-yellow" />
                          <span className="text-xs uppercase tracking-wider">Stars</span>
                        </div>
                        <p className="text-2xl font-bold text-text-primary">{formatNumber(selectedServer.githubStars)}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface border border-border">
                        <div className="flex items-center gap-2 text-text-muted mb-1">
                          <Download className="w-4 h-4 text-accent-green" />
                          <span className="text-xs uppercase tracking-wider">Downloads</span>
                        </div>
                        <p className="text-2xl font-bold text-text-primary">{formatNumber(selectedServer.downloadCount)}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface border border-border">
                        <div className="flex items-center gap-2 text-text-muted mb-1">
                          <Tag className="w-4 h-4 text-accent-purple" />
                          <span className="text-xs uppercase tracking-wider">Category</span>
                        </div>
                        <p className="text-sm font-semibold text-text-primary">{formatCategory(selectedServer.category)}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-surface border border-border">
                        <div className="flex items-center gap-2 text-text-muted mb-1">
                          <Clock className="w-4 h-4 text-accent-blue" />
                          <span className="text-xs uppercase tracking-wider">Updated</span>
                        </div>
                        <p className="text-sm font-semibold text-text-primary">{formatDate(selectedServer.updatedAt)}</p>
                      </div>
                    </div>

                    {/* API Key Warning */}
                    {selectedServer.requiresApiKey && (
                      <div className="p-4 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20 mb-8 flex items-start gap-3">
                        <Key className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-accent-yellow">API Key Required</p>
                          <p className="text-sm text-text-secondary mt-1">
                            This MCP server requires an API key to function. Make sure to configure it before use.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {selectedServer.tags.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedServer.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-3 py-1.5 bg-surface-raised rounded-lg text-sm text-text-secondary"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Usage Description */}
                    <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 border border-accent-purple/20">
                      <h3 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-accent-purple" />
                        What will you use this MCP for?
                      </h3>
                      <p className="text-sm text-text-muted mb-4">
                        Describe how you want to use this MCP server for this specific node. This helps the AI understand your intent.
                      </p>
                      <textarea
                        value={usageDescription}
                        onChange={e => setUsageDescription(e.target.value)}
                        placeholder="e.g., Use this MCP to generate images based on the user's description, focusing on realistic photography style..."
                        rows={4}
                        className="w-full px-4 py-3 bg-canvas border border-border rounded-xl text-sm text-text-primary
                                 placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple/50
                                 focus:border-accent-purple resize-none"
                      />
                    </div>

                    {/* GitHub Link */}
                    <a
                      href={selectedServer.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised hover:bg-surface-overlay rounded-xl text-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
                    >
                      <Github className="w-4 h-4" />
                      View on GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* Attach Options */}
                    <div className="mb-6 p-4 rounded-xl bg-surface border border-border">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attachToAllNodes}
                          onChange={(e) => setAttachToAllNodes(e.target.checked)}
                          className="w-5 h-5 rounded border-border text-accent-purple focus:ring-accent-purple/50 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-medium text-text-primary">Attach to all nodes</span>
                          <p className="text-xs text-text-muted mt-0.5">
                            This MCP server will be available on every node in the plan
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4 pt-6 border-t border-border">
                      <div className="flex-1" />
                      <button
                        onClick={() => setShowDetail(false)}
                        className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirm}
                        className="px-8 py-3 bg-gradient-to-r from-accent-purple to-accent-blue text-white rounded-xl font-semibold
                                 hover:shadow-lg hover:shadow-accent-purple/25 hover:-translate-y-0.5 transition-all"
                      >
                        {attachToAllNodes ? 'Attach to All Nodes' : 'Attach MCP Server'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
