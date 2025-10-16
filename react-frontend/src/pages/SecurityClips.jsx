import React, { useState, useEffect } from 'react';
import { Video, Calendar, Camera, AlertTriangle, Play, Trash2, CheckSquare, Square, Search, Sparkles, FileText, Scissors } from 'lucide-react';
const API_BASE_URL = 'http://localhost:8000';

const SecurityClips = () => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [clipSummary, setClipSummary] = useState('');
  const [highlightsUrl, setHighlightsUrl] = useState('');
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    fetchClips();
  }, []);

  const fetchClips = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/videodb/clips');
      const data = await response.json();
      setClips(data.clips || []);
    } catch (error) {
      console.error('Failed to fetch clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (videoId) => {
    setSelectedIds(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.length === clips.length ? [] : clips.map(c => c.video_id));
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    setDeleting(true);
    try {
      const response = await fetch('http://localhost:8000/api/videodb/clips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: selectedIds })
      });
      
      const data = await response.json();
      setClips(clips.filter(c => !data.deleted.includes(c.video_id)));
      setSelectedIds([]);
      if (selectedClip && selectedIds.includes(selectedClip.video_id)) {
        setSelectedClip(null);
      }
    } catch (error) {
      console.error('Failed to delete clips:', error);
    } finally {
      setDeleting(false);
    }
  };

  const semanticSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await fetch(`http://localhost:8000/api/videodb/search?query=${encodeURIComponent(searchQuery)}&limit=10`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const generateSummary = async (videoId) => {
    setProcessing(prev => ({ ...prev, [videoId]: 'summary' }));
    try {
      const response = await fetch(`http://localhost:8000/api/videodb/clips/${videoId}/summary`, {
        method: 'POST'
      });
      const data = await response.json();
      setClipSummary(data.summary);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setProcessing(prev => ({ ...prev, [videoId]: null }));
    }
  };

  const extractHighlights = async (videoId) => {
    setProcessing(prev => ({ ...prev, [videoId]: 'highlights' }));
    try {
      const response = await fetch(`http://localhost:8000/api/videodb/clips/${videoId}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 30 })
      });
      const data = await response.json();
      setHighlightsUrl(data.highlights_url);
    } catch (error) {
      console.error('Failed to extract highlights:', error);
    } finally {
      setProcessing(prev => ({ ...prev, [videoId]: null }));
    }
  };

  const generateSceneIndex = async (videoId) => {
    setProcessing(prev => ({ ...prev, [videoId]: 'indexing' }));
    try {
      await fetch(`http://localhost:8000/api/videodb/clips/${videoId}/scene-index`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to generate scene index:', error);
    } finally {
      setProcessing(prev => ({ ...prev, [videoId]: null }));
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const extractCameraId = (name) => {
    const parts = name.split('_');
    return parts[2] || 'Unknown';
  };

  const extractEventType = (name) => {
    const parts = name.split('_');
    return parts[0] || 'unknown';
  };

  return (
    <div className="min-h-screen bg-black p-6 pt-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#d4d4d4] mb-2 flex items-center">
                <Video className="w-8 h-8 mr-3 text-[#007acc]" />
                Security Clips
              </h1>
              <p className="text-[#858585]">Recorded security events • Auto-deleted after 3 days</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-[#cccccc] rounded border border-[#1a1a1a] transition-colors"
              >
                <Search className="w-4 h-4" />
                AI Search
              </button>
              {clips.length > 0 && (
                <>
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-[#cccccc] rounded border border-[#1a1a1a] transition-colors"
                  >
                    {selectedIds.length === clips.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {selectedIds.length === clips.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={deleteSelected}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2 bg-[#c5c5c5] hover:bg-[#858585] text-[#1e1e1e] rounded font-medium transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting ? 'Deleting...' : `Delete ${selectedIds.length}`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="mb-6 bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos by content (e.g., 'person walking', 'suspicious activity')..."
                className="flex-1 px-4 py-2 bg-[#1a1a1a] text-[#d4d4d4] rounded border border-[#2a2a2a] focus:border-[#007acc] focus:outline-none"
                onKeyPress={(e) => e.key === 'Enter' && semanticSearch()}
              />
              <button
                onClick={semanticSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-2 bg-[#007acc] hover:bg-[#005a9e] text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[#d4d4d4] font-medium mb-2">Search Results:</h3>
                {searchResults.map((result, index) => (
                  <div key={index} className="bg-[#1a1a1a] p-3 rounded border border-[#2a2a2a]">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[#4ec9b0] font-medium">Score: {result.score.toFixed(2)}</span>
                      <span className="text-[#858585] text-sm">{result.start}s - {result.end}s</span>
                    </div>
                    <p className="text-[#d4d4d4] text-sm">{result.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#007acc] mx-auto"></div>
            <p className="text-[#858585] mt-4">Loading clips...</p>
          </div>
        ) : clips.length === 0 ? (
          <div className="bg-[#0a0a0a] rounded-lg p-12 text-center border border-[#1a1a1a]">
            <AlertTriangle className="w-16 h-16 text-[#858585] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#cccccc] mb-2">No Security Clips</h3>
            <p className="text-[#858585]">Clips appear when security events are detected</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clips.map((clip) => (
              <div key={clip.video_id} className={`bg-[#0a0a0a] rounded-lg overflow-hidden border transition-colors shadow-lg ${
                selectedIds.includes(clip.video_id) ? 'border-[#007acc]' : 'border-[#1a1a1a] hover:border-[#007acc]'
              }`}>
                <div className="relative bg-black h-40 group">
                  <div 
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => setSelectedClip(clip)}
                  >
                    {clip.thumbnail_url ? (
                      <img 
                        src={clip.thumbnail_url} 
                        alt={clip.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                        <Video className="w-12 h-12 text-[#858585]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <div className="bg-[#007acc] rounded-full p-3 group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-white" fill="white" />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(clip.video_id); }}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-black/80 hover:bg-black rounded transition-colors"
                  >
                    {selectedIds.includes(clip.video_id) ? (
                      <CheckSquare className="w-5 h-5 text-[#007acc]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#cccccc]" />
                    )}
                  </button>
                </div>
                
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center text-[#858585] text-xs mb-1">
                        <Camera className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{extractCameraId(clip.name)}</span>
                      </div>
                      <div className="flex items-center text-[#858585] text-xs">
                        <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{formatDateTime(clip.created_at)}</span>
                      </div>
                    </div>
                    <span className="ml-2 px-2 py-1 bg-[#1a1a1a] text-[#4ec9b0] text-xs rounded flex-shrink-0">
                      {clip.length}s
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-[#f48771] bg-[#1a1a1a] px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    <span className="capitalize truncate">{extractEventType(clip.name).replace('activity_', '')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedClip && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" onClick={() => setSelectedClip(null)}>
          <div className="bg-[#0a0a0a] rounded-lg w-full max-w-5xl max-h-[90vh] overflow-auto border border-[#007acc]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0a0a0a] flex justify-between items-center p-4 border-b border-[#1a1a1a] z-10">
              <div>
                <h2 className="text-lg font-semibold text-[#d4d4d4] mb-1">{extractCameraId(selectedClip.name)}</h2>
                <p className="text-xs text-[#858585]">{formatDateTime(selectedClip.created_at)}</p>
              </div>
              <button 
                onClick={() => setSelectedClip(null)} 
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[#c5c5c5] hover:bg-[#858585] rounded text-[#1e1e1e] text-2xl font-bold transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="p-4">
              <div className="relative w-full bg-black rounded overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={selectedClip.player_url}
                  className="absolute top-0 left-0 w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="bg-[#1a1a1a] p-3 rounded border border-[#2a2a2a]">
                  <p className="text-[#858585] text-xs mb-1">Camera ID</p>
                  <p className="text-[#d4d4d4] font-medium">{extractCameraId(selectedClip.name)}</p>
                </div>
                
                <div className="bg-[#1a1a1a] p-3 rounded border border-[#2a2a2a]">
                  <p className="text-[#858585] text-xs mb-1">Duration</p>
                  <p className="text-[#4ec9b0] font-medium">{selectedClip.length}s</p>
                </div>
                
                <div className="bg-[#1a1a1a] p-3 rounded border border-[#2a2a2a]">
                  <p className="text-[#858585] text-xs mb-1">Event Type</p>
                  <p className="text-[#f48771] font-medium capitalize">{extractEventType(selectedClip.name).replace('activity_', '')}</p>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3 flex-wrap">
                <button
                  onClick={() => generateSummary(selectedClip.video_id)}
                  disabled={processing[selectedClip.video_id] === 'summary'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#007acc] hover:bg-[#005a9e] text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {processing[selectedClip.video_id] === 'summary' ? 'Generating...' : 'AI Summary'}
                </button>
                
                <button
                  onClick={() => extractHighlights(selectedClip.video_id)}
                  disabled={processing[selectedClip.video_id] === 'highlights'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4ec9b0] hover:bg-[#3a9b7a] text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  <Scissors className="w-4 h-4" />
                  {processing[selectedClip.video_id] === 'highlights' ? 'Extracting...' : 'Extract Highlights'}
                </button>
                
                <button
                  onClick={() => generateSceneIndex(selectedClip.video_id)}
                  disabled={processing[selectedClip.video_id] === 'indexing'}
                  className="flex items-center gap-2 px-4 py-2 bg-[#f48771] hover:bg-[#d4705a] text-white rounded font-medium transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {processing[selectedClip.video_id] === 'indexing' ? 'Indexing...' : 'Scene Index'}
                </button>
              </div>
              
              {clipSummary && (
                <div className="mt-4 bg-[#1a1a1a] p-4 rounded border border-[#2a2a2a]">
                  <h4 className="text-[#d4d4d4] font-medium mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    AI Summary
                  </h4>
                  <p className="text-[#cccccc] text-sm leading-relaxed">{clipSummary}</p>
                </div>
              )}
              
              {highlightsUrl && (
                <div className="mt-4 bg-[#1a1a1a] p-4 rounded border border-[#2a2a2a]">
                  <h4 className="text-[#d4d4d4] font-medium mb-2 flex items-center">
                    <Scissors className="w-4 h-4 mr-2" />
                    Highlights (30s)
                  </h4>
                  <div className="relative w-full bg-black rounded overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                    <video
                      src={highlightsUrl}
                      controls
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityClips;
