import type { Channel } from '@/components/ui/ChannelIcon';

export interface SampleProduct {
  id: string;
  name: string;
  variant: string;
  category: string;
  price: number;
  stock: number;
  waiting?: number; // people waiting for a restock
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { id: 'p1', name: 'Essential Hoodie', variant: 'Black', category: 'Hoodies', price: 45000, stock: 12 },
  { id: 'p2', name: 'Essential Hoodie', variant: 'Cream', category: 'Hoodies', price: 45000, stock: 3 },
  { id: 'p3', name: 'Cargo Pants', variant: 'Olive', category: 'Bottoms', price: 62000, stock: 0, waiting: 4 },
  { id: 'p4', name: 'Black Jorts', variant: 'Washed black', category: 'Bottoms', price: 45000, stock: 9 },
  { id: 'p5', name: 'Essential Tee', variant: 'White', category: 'Tees', price: 25000, stock: 20 },
  { id: 'p6', name: 'Cargo Set', variant: 'Sand', category: 'Sets', price: 98000, stock: 5 },
  { id: 'p7', name: 'Court Sneakers', variant: 'White', category: 'Shoes', price: 85000, stock: 2 },
  { id: 'p8', name: 'Logo Cap', variant: 'Black', category: 'Accessories', price: 15000, stock: 14 },
];

export interface SampleOrder {
  id: string;
  item: string;
  price: number;
  status: 'Awaiting payment' | 'Paid' | 'Delivered';
  source: Channel;
  date: string;
}

export interface SampleCustomer {
  id: string;
  name: string;
  since: string;
  area: string;
  lastActive: string;
  whatsapp?: string;
  instagram?: string;
  email?: string;
  orders: SampleOrder[];
  waitingFor?: string;
  notes?: string;
}

export const SAMPLE_CUSTOMERS: SampleCustomer[] = [
  {
    id: 'c1',
    name: 'Adaeze Okonkwo',
    since: 'March 2026',
    area: 'Lekki',
    lastActive: '2m',
    whatsapp: '+234 803 412 7780',
    instagram: 'adaeze.o',
    email: 'adaeze.okonkwo@gmail.com',
    orders: [
      { id: '#1051', item: 'Essential Hoodie, Black', price: 48500, status: 'Awaiting payment', source: 'whatsapp', date: 'Today' },
      { id: '#1033', item: 'Cargo Pants, Olive', price: 62000, status: 'Paid', source: 'store', date: '12 Sep' },
      { id: '#1019', item: 'Black Jorts', price: 45000, status: 'Delivered', source: 'website', date: '28 Aug' },
    ],
    waitingFor: 'Cargo Set, Olive, size M',
    notes: 'Size L in tops, 32 in bottoms. Prefers black.',
  },
  {
    id: 'c2',
    name: 'Tobi Fashola',
    since: 'June 2026',
    area: 'Yaba',
    lastActive: '14m',
    instagram: 'tobi.fits',
    orders: [
      { id: '#1044', item: 'Court Sneakers, White', price: 85000, status: 'Delivered', source: 'instagram', date: '20 Sep' },
    ],
    notes: 'Asks about new drops first. Size 43 shoes.',
  },
  {
    id: 'c3',
    name: 'Kemi Balogun',
    since: 'January 2026',
    area: 'Ikeja',
    lastActive: '1h',
    email: 'kemi.balogun@outlook.com',
    whatsapp: '+234 812 555 0192',
    orders: [
      { id: '#1042', item: 'Cargo Set, Sand', price: 98000, status: 'Paid', source: 'website', date: '25 Sep' },
      { id: '#1008', item: 'Essential Tee x2', price: 50000, status: 'Delivered', source: 'store', date: '2 Aug' },
    ],
  },
  {
    id: 'c4',
    name: 'Chidi Nnamdi',
    since: 'September 2026',
    area: 'Surulere',
    lastActive: '5h',
    instagram: 'chiboy_drip',
    orders: [],
    waitingFor: 'Cargo Pants, Olive, size 34',
  },
];

export function naira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function totalSpent(c: SampleCustomer) {
  return c.orders.filter((o) => o.status !== 'Awaiting payment').reduce((sum, o) => sum + o.price, 0);
}