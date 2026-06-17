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
        <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
                {reviewerAvatar ? (
                    <img src={reviewerAvatar} alt={reviewerName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 flex-shrink-0">
                        {reviewerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-gray-800 truncate">{reviewerName}</p>
                    <p className="text-[10px] text-gray-400">{new Date(createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-xs ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-1">{LABELS[rating]}</span>
                </div>
            </div>
            {content && <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{content}</p>}
        </div>
    );
}