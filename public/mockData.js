// Mock database for System Axtral Store Management
window.AxtralMockData = {
  products: [
    {
      id: "prod-1",
      name: "Mouse Gamer Axtral Neon",
      sku: "AXT-MS-88",
      category: "Acessórios",
      price: 249.90,
      cost: 110.00,
      stock: 42,
      minStock: 10,
      sold: 156,
      color: "linear-gradient(135deg, #7c3aed, #a78bfa)"
    },
    {
      id: "prod-2",
      name: "Teclado Mecânico Axtral Pro",
      sku: "AXT-KB-99",
      category: "Periféricos",
      price: 589.90,
      cost: 260.00,
      stock: 15,
      minStock: 5,
      sold: 98,
      color: "linear-gradient(135deg, #4f46e5, #7c3aed)"
    },
    {
      id: "prod-3",
      name: "Headset Gamer wireless Pulse",
      sku: "AXT-HS-12",
      category: "Áudio",
      price: 429.90,
      cost: 180.00,
      stock: 3,
      minStock: 8,
      sold: 74,
      color: "linear-gradient(135deg, #7c3aed, #c084fc)"
    },
    {
      id: "prod-4",
      name: "Monitor Axtral Curved 27'",
      sku: "AXT-MN-27",
      category: "Monitores",
      price: 1899.00,
      cost: 950.00,
      stock: 12,
      minStock: 4,
      sold: 34,
      color: "linear-gradient(135deg, #1e1b4b, #312e81)"
    },
    {
      id: "prod-5",
      name: "Cadeira Gamer Ergonomic-X",
      sku: "AXT-CH-01",
      category: "Móveis",
      price: 1299.90,
      cost: 620.00,
      stock: 6,
      minStock: 3,
      sold: 21,
      color: "linear-gradient(135deg, #c084fc, #a78bfa)"
    },
    {
      id: "prod-6",
      name: "Mousepad Speed XL Spectrum",
      sku: "AXT-MP-05",
      category: "Acessórios",
      price: 119.90,
      cost: 40.00,
      stock: 65,
      minStock: 15,
      sold: 220,
      color: "linear-gradient(135deg, #09090b, #7c3aed)"
    },
    {
      id: "prod-7",
      name: "Webcam Axtral Streamer 4K",
      sku: "AXT-WC-4K",
      category: "Periféricos",
      price: 649.90,
      cost: 300.00,
      stock: 2,
      minStock: 5,
      sold: 45,
      color: "linear-gradient(135deg, #4f46e5, #c084fc)"
    },
    {
      id: "prod-8",
      name: "Microfone Condensador Vocalist",
      sku: "AXT-MC-02",
      category: "Áudio",
      price: 379.90,
      cost: 150.00,
      stock: 25,
      minStock: 6,
      sold: 83,
      color: "linear-gradient(135deg, #6366f1, #7c3aed)"
    }
  ],
  customers: [
    {
      id: "cust-1",
      name: "Thiago Silva",
      email: "thiago.silva@email.com",
      phone: "(11) 98765-4321",
      totalSpent: 2738.80,
      points: 270,
      tier: "Gold"
    },
    {
      id: "cust-2",
      name: "Mariana Costa",
      email: "mariana.c@email.com",
      phone: "(21) 99888-7766",
      totalSpent: 1899.00,
      points: 190,
      tier: "Silver"
    },
    {
      id: "cust-3",
      name: "Lucas Oliveira",
      email: "lucas.ol@email.com",
      phone: "(31) 97777-8888",
      totalSpent: 5128.50,
      points: 510,
      tier: "Platinum"
    },
    {
      id: "cust-4",
      name: "Beatriz Santos",
      email: "bia.santos@email.com",
      phone: "(19) 99654-3210",
      totalSpent: 369.80,
      points: 35,
      tier: "Bronze"
    },
    {
      id: "cust-5",
      name: "Felipe Almeida",
      email: "felipe.almeida@email.com",
      phone: "(41) 99123-4567",
      totalSpent: 0.00,
      points: 0,
      tier: "Bronze"
    }
  ],
  sales: [
    {
      id: "VNDA-1001",
      date: "2026-05-20T10:30:00-03:00",
      products: [
        { productId: "prod-1", quantity: 1, price: 249.90 },
        { productId: "prod-6", quantity: 2, price: 119.90 }
      ],
      subtotal: 489.70,
      discount: 20.00,
      total: 469.70,
      paymentMethod: "Cartão de Crédito",
      customerName: "Thiago Silva"
    },
    {
      id: "VNDA-1002",
      date: "2026-05-21T14:15:00-03:00",
      products: [
        { productId: "prod-4", quantity: 1, price: 1899.00 }
      ],
      subtotal: 1899.00,
      discount: 0.00,
      total: 1899.00,
      paymentMethod: "PIX",
      customerName: "Mariana Costa"
    },
    {
      id: "VNDA-1003",
      date: "2026-05-21T18:45:00-03:00",
      products: [
        { productId: "prod-3", quantity: 1, price: 429.90 },
        { productId: "prod-8", quantity: 1, price: 379.90 }
      ],
      subtotal: 809.80,
      discount: 40.00,
      total: 769.80,
      paymentMethod: "Dinheiro",
      customerName: "Lucas Oliveira"
    },
    {
      id: "VNDA-1004",
      date: "2026-05-22T09:00:00-03:00",
      products: [
        { productId: "prod-2", quantity: 1, price: 589.90 }
      ],
      subtotal: 589.90,
      discount: 0.00,
      total: 589.90,
      paymentMethod: "PIX",
      customerName: "Beatriz Santos"
    }
  ]
};
