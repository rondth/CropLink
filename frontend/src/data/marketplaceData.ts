export interface Product { 
    id: string; 
    name: string; 
    emoji: string; 
    category: string[]; 
    location: string; 
    price: number; 
    unit: string; 
    rating: number; 
    farmer: { 
        name: string; 
        initial: string; 
        color: string; 
        verified: boolean 
    }; 
    soldCount: string; 
    badge?: { 
        text: string; 
        type: 'hot' | 'new' | 'sale' 
    }; 
}
    
export const CATEGORIES = [ 
    { 
        id: 'all', 
        label: 'All', 
        icon: '/all.png' 
    }, 
    { 
        id: 'veg', 
        label: 'Vegetables', 
        icon: '/vegetable.png' 
 }, 
    { 
        id: 'fruit', 
        label: 'Fruits', 
        icon: '/fruits.png' 
    }, 
    { 
        id: 'grain', 
        label: 'Grains', 
        icon: '/grains.png' 
    }, 
    { 
        id: 'herb', 
        label: 'Herbs', 
        icon: '/herb.png' 
    }, 
    { 
        id: 'organic', 
        label: 'Organic', 
        icon: '/organic.png' 
    } 
];

export const PRODUCTS: Product[] = [
    { 
        id: 'p1', 
        name: 'Organic Tomatoes', 
        emoji: '/tomato.png', 
        category: ['veg'], 
        location: 'Lim Chu Kang', 
        price: 3.50, 
        unit: 'per kg · 500kg avail.', 
        rating: 4.8, 
        farmer: { 
            name: 'Tan Wei Ming', 
            initial: 'T', 
            color: '#2d5a27', 
            verified: true 
        },
        soldCount: '1.2k sold this month', 
        badge: { 
            text: 'Hot', 
            type: 'hot'                 
        } 
    },
    { 
        id: 'p2', 
        name: 'Fresh Lettuce', 
        emoji: '/lettuce.png', 
        category: ['veg'], 
        location: 'Kranji', 
        price: 2.20, 
        unit: 'per kg · 300kg avail.', 
        rating: 4.9, 
        farmer: { 
            name: 'Siti Nurhaliza', 
            initial: 'S', 
            color: '#5a4a2d', 
            verified: true 
        }, 
        soldCount: '876 sold this month', 
        badge: { 
            text: 'New', 
            type: 'new' 
        } 
    },
    { 
        id: 'p3', 
        name: 'Chinese Cabbage', 
        emoji: '/brocolli.png', 
        category: ['veg'], 
        location: 'Sungei Tengah', 
        price: 1.80, 
        unit: 'per kg · 800kg avail.', 
        rating: 4.7, 
        farmer: { 
            name: 'Kumar Raj', 
            initial: 'K', 
            color: '#2d3a5a', 
            verified: true 
        }, 
        soldCount: '2.1k sold this month', 
        badge: { 
            text: 'Sale', 
            type: 'sale' 
        } 
    },
    { 
        id: 'p4', 
        name: 'Sweet Corn', 
        emoji: '/corn.png', 
        category: ['grain'], 
        location: 'Yishun', 
        price: 1.40, 
        unit: 'per kg · 1.2t avail.', 
        rating: 4.6, 
        farmer: { 
            name: 'Ahmed b. Hassan', 
            initial: 'A', 
            color: '#5a2d2d', 
            verified: true 
        }, 
        soldCount: '3.4k sold this month', 
        badge: { 
            text: 'Hot', 
            type: 'hot' 
        } 
    },
    { 
        id: 'p5', 
        name: 'Water Spinach', 
        emoji: '/spinach.png', 
        category: ['herb'], 
        location: 'Punggol', 
        price: 1.20, 
        unit: 'per kg · 650kg avail.', 
        rating: 4.5, 
        farmer: { 
            name: 'Ravi Subramaniam', 
            initial: 'R', 
            color: '#2d5a4a', 
            verified: false 
        }, 
        soldCount: '420 sold this month', 
        badge: { 
            text: 'New', 
            type: 'new' 
        } 
    },
    { 
        id: 'p6', 
        name: 'Red Chilli', 
        emoji: '/chilli.png', 
        category: ['veg', 'organic'], 
        location: 'Bukit Timah', 
        price: 4.50, 
        unit: 'per kg · 200kg avail.', 
        rating: 4.8, 
        farmer: { 
            name: 'Lim Ah Kow', 
            initial: 'L', 
            color: '#5a3a2d', 
            verified: true 
        }, 
        soldCount: '980 sold this month', 
        badge: { 
            text: 'Hot', 
            type: 'hot' 
        } 
    }
];