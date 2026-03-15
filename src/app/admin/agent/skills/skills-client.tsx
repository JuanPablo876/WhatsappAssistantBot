'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Skill {
  id: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  reviewStatus: 'PROPOSED' | 'REVIEWED' | 'REJECTED' | 'ARCHIVED';
  deliveryMode: 'KNOWLEDGE' | 'NATIVE_TOOL';
  isEnabled: boolean;
  priority: number;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  sourceCount: number;
}

interface SkillDetail extends Skill {
  workflowGuidance: string;
  implementationNotes: string;
  codeSnippets: string[];
  sources: Array<{
    id: string;
    url: string;
    title: string;
    sourceType: string;
    snippet: string;
    fetchedAt: string;
  }>;
  createdBy: { name: string; email: string };
  updatedBy?: { name: string; email: string };
}

const statusColors: Record<string, string> = {
  PROPOSED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  REVIEWED: 'bg-green-500/20 text-green-300 border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  ARCHIVED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const categoryColors: Record<string, string> = {
  'api-integration': 'bg-blue-500/20 text-blue-300',
  workflow: 'bg-purple-500/20 text-purple-300',
  'product-knowledge': 'bg-emerald-500/20 text-emerald-300',
  troubleshooting: 'bg-orange-500/20 text-orange-300',
  'best-practice': 'bg-cyan-500/20 text-cyan-300',
  general: 'bg-gray-500/20 text-gray-300',
};

export default function SkillsClient() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filters, setFilters] = useState({ search: '', category: '', reviewStatus: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadSkills();
  }, [page, filters]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.reviewStatus) params.set('reviewStatus', filters.reviewStatus);

      const res = await fetch(`/api/admin/agent/skills?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSkillDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/agent/skills/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSkill(data.skill);
        setShowDetail(true);
      }
    } catch (error) {
      console.error('Failed to load skill detail:', error);
    }
  };

  const updateSkill = async (id: string, updates: Partial<Skill>) => {
    try {
      const res = await fetch(`/api/admin/agent/skills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        loadSkills();
        if (selectedSkill?.id === id) {
          loadSkillDetail(id);
        }
      }
    } catch (error) {
      console.error('Failed to update skill:', error);
    }
  };

  const deleteSkill = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this skill?')) return;
    try {
      const res = await fetch(`/api/admin/agent/skills/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadSkills();
        if (selectedSkill?.id === id) {
          setShowDetail(false);
          setSelectedSkill(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white/90">Knowledge Skills</h1>
          <p className="text-sm text-white/50 mt-1">Manage agent knowledge base</p>
        </div>
        <Link
          href="/admin/agent"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500/20 to-purple-500/20 hover:from-red-500/30 hover:to-purple-500/30 border border-white/[0.08] text-sm text-white/90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Open Agent Chat
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search skills..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/[0.2] w-full sm:w-64"
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-white/[0.2]"
        >
          <option value="">All Categories</option>
          <option value="api-integration">API Integration</option>
          <option value="workflow">Workflow</option>
          <option value="product-knowledge">Product Knowledge</option>
          <option value="troubleshooting">Troubleshooting</option>
          <option value="best-practice">Best Practice</option>
          <option value="general">General</option>
        </select>
        <select
          value={filters.reviewStatus}
          onChange={(e) => setFilters({ ...filters, reviewStatus: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 focus:outline-none focus:border-white/[0.2]"
        >
          <option value="">All Statuses</option>
          <option value="PROPOSED">Proposed</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Skills Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Usage</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Enabled</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : skills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                    No skills found. Use the Agent to create new knowledge skills.
                  </td>
                </tr>
              ) : (
                skills.map((skill) => (
                  <tr
                    key={skill.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => loadSkillDetail(skill.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white/90">{skill.title}</div>
                      <div className="text-xs text-white/40 mt-0.5 line-clamp-1">{skill.summary}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[skill.category] || categoryColors.general}`}>
                        {skill.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs border ${statusColors[skill.reviewStatus]}`}>
                        {skill.reviewStatus.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-sm text-white/60">{skill.usageCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSkill(skill.id, { isEnabled: !skill.isEnabled });
                        }}
                        className={`w-8 h-5 rounded-full transition-colors ${
                          skill.isEnabled ? 'bg-green-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            skill.isEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {skill.reviewStatus === 'PROPOSED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSkill(skill.id, { reviewStatus: 'REVIEWED' });
                            }}
                            className="p-1.5 rounded hover:bg-green-500/20 text-green-400"
                            title="Mark as reviewed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {skill.reviewStatus !== 'ARCHIVED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSkill(skill.id, { reviewStatus: 'ARCHIVED' });
                            }}
                            className="p-1.5 rounded hover:bg-yellow-500/20 text-yellow-400"
                            title="Archive"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSkill(skill.id);
                          }}
                          className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                          title="Delete permanently"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-sm text-white/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08]"
            >
              Previous
            </button>
            <span className="text-sm text-white/50">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-sm text-white/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.08]"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedSkill && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowDetail(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-8 md:bottom-8 md:w-[720px] z-50 bg-[#12121a] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-lg font-semibold text-white/90">{selectedSkill.title}</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 rounded-lg hover:bg-white/[0.06]"
                >
                  <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Meta info */}
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[selectedSkill.category] || categoryColors.general}`}>
                    {selectedSkill.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs border ${statusColors[selectedSkill.reviewStatus]}`}>
                    {selectedSkill.reviewStatus.toLowerCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-white/[0.06] text-white/50">
                    {selectedSkill.usageCount} uses
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-white/[0.06] text-white/50">
                    Priority: {selectedSkill.priority}
                  </span>
                </div>

                {/* Tags */}
                {selectedSkill.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedSkill.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-white/[0.04] text-xs text-white/50">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-2">Summary</h3>
                  <p className="text-sm text-white/60">{selectedSkill.summary}</p>
                </div>

                {/* Workflow Guidance */}
                {selectedSkill.workflowGuidance && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">Workflow Guidance</h3>
                    <div className="prose prose-invert prose-sm max-w-none text-white/60 bg-white/[0.02] rounded-lg p-4 border border-white/[0.06]">
                      <pre className="whitespace-pre-wrap text-xs">{selectedSkill.workflowGuidance}</pre>
                    </div>
                  </div>
                )}

                {/* Implementation Notes */}
                {selectedSkill.implementationNotes && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">Implementation Notes</h3>
                    <div className="text-sm text-white/60 bg-white/[0.02] rounded-lg p-4 border border-white/[0.06]">
                      <pre className="whitespace-pre-wrap text-xs">{selectedSkill.implementationNotes}</pre>
                    </div>
                  </div>
                )}

                {/* Code Snippets */}
                {selectedSkill.codeSnippets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">Code Snippets</h3>
                    <div className="space-y-2">
                      {selectedSkill.codeSnippets.map((snippet, i) => (
                        <pre key={i} className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto text-white/70">
                          {snippet}
                        </pre>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources */}
                {selectedSkill.sources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white/70 mb-2">Sources ({selectedSkill.sources.length})</h3>
                    <div className="space-y-2">
                      {selectedSkill.sources.map((source) => (
                        <div key={source.id} className="text-xs bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate block">
                            {source.url}
                          </a>
                          {source.snippet && <p className="text-white/50 mt-1">{source.snippet}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit info */}
                <div className="text-xs text-white/40 space-y-1 pt-4 border-t border-white/[0.06]">
                  <p>Created by {selectedSkill.createdBy.name} on {new Date(selectedSkill.createdAt).toLocaleDateString()}</p>
                  {selectedSkill.updatedBy && (
                    <p>Last updated by {selectedSkill.updatedBy.name} on {new Date(selectedSkill.updatedAt).toLocaleDateString()}</p>
                  )}
                  {selectedSkill.lastUsedAt && (
                    <p>Last used: {new Date(selectedSkill.lastUsedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
                {selectedSkill.reviewStatus !== 'ARCHIVED' && selectedSkill.reviewStatus !== 'REVIEWED' && (
                  <button
                    onClick={() => updateSkill(selectedSkill.id, { reviewStatus: 'REVIEWED' })}
                    className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-sm transition-colors"
                  >
                    Mark Reviewed
                  </button>
                )}
                {selectedSkill.reviewStatus !== 'ARCHIVED' && (
                  <button
                    onClick={() => updateSkill(selectedSkill.id, { reviewStatus: 'ARCHIVED' })}
                    className="px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-sm transition-colors"
                  >
                    Archive
                  </button>
                )}
                {selectedSkill.reviewStatus === 'ARCHIVED' && (
                  <button
                    onClick={() => updateSkill(selectedSkill.id, { reviewStatus: 'PROPOSED', isEnabled: true })}
                    className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm transition-colors"
                  >
                    Restore
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
