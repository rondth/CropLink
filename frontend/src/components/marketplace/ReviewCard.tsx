import React from 'react';

interface ReviewCardProps {
    reviewerName: string;
    reviewerAvatar?: string;
    rating: number;
    content?: string;
    createdAt: string;
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function ReviewCard({ reviewerName, reviewerAvatar, rating, content, createdAt }: ReviewCardProps) {
    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
                {reviewerAvatar ? (
                    <img src={reviewerAvatar} alt={reviewerName} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400">
                        {reviewerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                )}
                <div>
                    <p className="text-sm font-black text-gray-800">{reviewerName}</p>
                    <p className="text-[10px] text-gray-400">{new Date(createdAt).toLocaleDateString()}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                    <span className="text-[11px] font-bold text-gray-400 ml-1">{LABELS[rating]}</span>
                </div>
            </div>
            {content && <p className="text-sm text-gray-600 mt-1">{content}</p>}
        </div>
    );
}