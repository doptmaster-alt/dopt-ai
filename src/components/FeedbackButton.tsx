'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'bug', label: '🐛 버그 신고' },
  { value: 'feature', label: '💡 기능 제안' },
  { value: 'ux', label: '🎨 UI/UX 개선' },
  { value: 'performance', label: '⚡ 성능 문제' },
  { value: 'general', label: '💬 기타 의견' },
];

const PRIORITIES = [
  { value: 'low', label: '낮음', color: 'text-gray-500' },
  { value: 'normal', label: '보통', color: 'text-blue-500' },
  { value: 'high', label: '높음', color: 'text-orange-500' },
  { value: 'urgent', label: '긴급', color: 'text-red-500' },
];

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setForm({ title: '', description: '', category: 'general', priority: 'normal' });
      }, 2000);
    } catch {
      alert('피드백 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl transition-transform hover:scale-110"
        title="피드백 보내기"
      >
        💬
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-lg font-bold text-gray-900">감사합니다!</h3>
                <p className="text-gray-500 mt-1">피드백이 전송되었습니다.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">피드백 보내기</h3>
                  <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                {/* Category */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setForm(f => ({ ...f, category: c.value }))}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          form.category === c.value
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          form.priority === p.value
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="간단히 요약해주세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="어떤 상황에서 발생했나요? 자세히 적어주세요."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !form.title.trim() || !form.description.trim()}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? '전송 중...' : '피드백 전송'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
