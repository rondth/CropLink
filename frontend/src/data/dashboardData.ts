export const SELLER_DASHBOARD_DATA = {
    sellerName: 'Bambang',

    quickStats: {
        monthlyRevenue: {
            amount: 4250.00,
            change: '+12%',
        },
        activeOrders: {
            count: 14,
            pending: 3,
        },
    },

    inventoryBreakdown: [
        { name: 'Organic Tomatoes', percentage: 45, color: '#ff6b6b' },
        { name: 'Fresh Lettuce', percentage: 30, color: '#4ade80' },
        { name: 'Sweet Corn', percentage: 25, color: '#facc15' },
    ],
    
    activeListings: [
        {
            name: 'Organic Tomatoes',
            sold : 300,
            quantity : 500,
            left : 200,
            price: 3.50,
            unit: 'kg',
            color: '#ff6b6b'
        },
        {
            name: 'Fresh Lettuce',
            sold : 100,
            quantity : 300,
            left : 200,
            price: 2.20,
            unit: 'lbs',
            color: '#4ade80'
        },
    ],
};

export const REVENUE_DATA = SELLER_DASHBOARD_DATA.inventoryBreakdown.map(item => ({
    name: item.name,
    percentage: item.percentage,
    color: item.color,
    price: (item.percentage / 100) * SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.amount,
}));
