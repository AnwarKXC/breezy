# 📦 DUMMY DATA SYSTEM — HOTEL MANAGEMENT

## 🧩 ROLE DEFINITION

You are a Senior Data Architect working alongside the Frontend Engineer.

Your job: Create a complete, realistic, and reusable dummy data system for the Hotel Management SaaS dashboard.

This data will feed ALL modules and components until a real backend is connected.

Context:

- Product: Hotel Management System
- Modules: Users, Contacts, Reservations, Accounting
- Language: TypeScript
- Data must support i18n (EN + AR)
- All components pull from this single source of truth

---

## 🧠 BEFORE YOU START

1. Restate the task
2. Ask 3–5 clarification questions
3. Propose step-by-step plan

DO NOT write code before this.

---

# 🗂️ DATA ARCHITECTURE

## File Structure

```
src/
└── data/
    ├── index.ts                  # re-exports everything
    ├── types/
    │   ├── user.types.ts
    │   ├── contact.types.ts
    │   ├── reservation.types.ts
    │   ├── accounting.types.ts
    │   ├── analytics.types.ts
    │   └── common.types.ts
    ├── users.data.ts
    ├── contacts.data.ts
    ├── reservations.data.ts
    ├── accounting.data.ts
    ├── analytics.data.ts
    ├── notifications.data.ts
    ├── sidebar.data.ts
    └── hotel.data.ts
```

---

# 📐 TYPE DEFINITIONS

## common.types.ts

```ts
export type Status =
  | "active"
  | "inactive"
  | "pending"
  | "cancelled"
  | "completed";

export type Currency = "USD" | "EUR" | "SAR" | "AED";

export type Language = "en" | "ar";

export type TrendDirection = "up" | "down" | "neutral";

export interface LocalizedString {
  en: string;
  ar: string;
}

export interface Address {
  street: string;
  city: string;
  country: string;
  zip: string;
}

export interface Trend {
  value: number;
  direction: TrendDirection;
  label: LocalizedString;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

---

## user.types.ts

```ts
import { Status, Address, LocalizedString } from "./common.types";

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "receptionist"
  | "accountant"
  | "housekeeping";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: LocalizedString;
  email: string;
  phone: string;
  avatar: string;
  role: UserRole;
  roleLabel: LocalizedString;
  department: LocalizedString;
  status: Status;
  address: Address;
  joinedAt: string;
  lastActiveAt: string;
  permissions: string[];
}
```

---

## contact.types.ts

```ts
import { Address, LocalizedString, Status } from "./common.types";

export type ContactType = "guest" | "corporate" | "vip" | "agency";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: LocalizedString;
  email: string;
  phone: string;
  avatar: string;
  type: ContactType;
  typeLabel: LocalizedString;
  company: string;
  status: Status;
  address: Address;
  nationality: LocalizedString;
  passportNumber: string;
  totalStays: number;
  totalSpent: number;
  lastVisit: string;
  createdAt: string;
  notes: LocalizedString;
}
```

---

## reservation.types.ts

```ts
import { Status, LocalizedString, Currency } from "./common.types";

export type RoomType =
  | "single"
  | "double"
  | "suite"
  | "deluxe"
  | "presidential";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "refunded";

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  typeLabel: LocalizedString;
  floor: number;
  capacity: number;
  pricePerNight: number;
  currency: Currency;
  amenities: LocalizedString[];
  status: Status;
}

export interface Reservation {
  id: string;
  confirmationCode: string;
  guestId: string;
  guestName: LocalizedString;
  guestEmail: string;
  guestPhone: string;
  guestAvatar: string;
  room: Room;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: Status;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
  currency: Currency;
  specialRequests: LocalizedString;
  source: "direct" | "booking.com" | "expedia" | "airbnb" | "phone";
  createdAt: string;
  updatedAt: string;
}
```

---

## accounting.types.ts

```ts
import { Currency, LocalizedString } from "./common.types";

export type TransactionType =
  | "payment"
  | "refund"
  | "expense"
  | "invoice"
  | "deposit";

export type TransactionCategory =
  | "room_revenue"
  | "food_beverage"
  | "spa"
  | "laundry"
  | "parking"
  | "maintenance"
  | "salary"
  | "utilities"
  | "marketing"
  | "other";

export interface Transaction {
  id: string;
  referenceNumber: string;
  type: TransactionType;
  typeLabel: LocalizedString;
  category: TransactionCategory;
  categoryLabel: LocalizedString;
  description: LocalizedString;
  amount: number;
  currency: Currency;
  reservationId?: string;
  guestName?: LocalizedString;
  status: "completed" | "pending" | "failed";
  date: string;
  createdBy: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  reservationId: string;
  guestName: LocalizedString;
  guestEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: Currency;
  status: "paid" | "unpaid" | "partial" | "overdue";
  issuedAt: string;
  dueAt: string;
}

export interface InvoiceItem {
  id: string;
  description: LocalizedString;
  quantity: number;
  unitPrice: number;
  total: number;
}
```

---

## analytics.types.ts

```ts
import { Trend, LocalizedString } from "./common.types";

export interface AnalyticsCard {
  id: string;
  label: LocalizedString;
  value: string | number;
  formattedValue: string;
  trend: Trend;
  icon: string;
  suffix?: string;
  prefix?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
}

export interface ModuleAnalytics {
  cards: AnalyticsCard[];
  chartData: ChartDataPoint[];
}
```

---

# 📊 DATA FILES

## users.data.ts

```ts
export const USERS_DATA: User[] = [
  {
    id: "usr_001",
    firstName: "Ahmed",
    lastName: "Al-Rashid",
    fullName: { en: "Ahmed Al-Rashid", ar: "أحمد الراشد" },
    email: "ahmed.rashid@hotel.com",
    phone: "+966 50 123 4567",
    avatar: "https://i.pravatar.cc/150?img=11",
    role: "super_admin",
    roleLabel: { en: "Super Admin", ar: "مدير عام" },
    department: { en: "Management", ar: "الإدارة" },
    status: "active",
    address: {
      street: "123 King Fahd Road",
      city: "Riyadh",
      country: "Saudi Arabia",
      zip: "12345",
    },
    joinedAt: "2022-01-15",
    lastActiveAt: "2024-06-01T08:30:00Z",
    permissions: ["all"],
  },
  {
    id: "usr_002",
    firstName: "Sara",
    lastName: "Al-Mutairi",
    fullName: { en: "Sara Al-Mutairi", ar: "سارة المطيري" },
    email: "sara.mutairi@hotel.com",
    phone: "+966 55 234 5678",
    avatar: "https://i.pravatar.cc/150?img=5",
    role: "manager",
    roleLabel: { en: "Manager", ar: "مدير" },
    department: { en: "Front Office", ar: "الاستقبال" },
    status: "active",
    address: {
      street: "45 Olaya Street",
      city: "Riyadh",
      country: "Saudi Arabia",
      zip: "12346",
    },
    joinedAt: "2022-03-20",
    lastActiveAt: "2024-06-01T09:15:00Z",
    permissions: ["reservations", "contacts", "reports"],
  },
  {
    id: "usr_003",
    firstName: "Mohammed",
    lastName: "Hassan",
    fullName: { en: "Mohammed Hassan", ar: "محمد حسن" },
    email: "mohammed.hassan@hotel.com",
    phone: "+966 54 345 6789",
    avatar: "https://i.pravatar.cc/150?img=12",
    role: "receptionist",
    roleLabel: { en: "Receptionist", ar: "موظف استقبال" },
    department: { en: "Front Office", ar: "الاستقبال" },
    status: "active",
    address: {
      street: "78 Tahlia Street",
      city: "Jeddah",
      country: "Saudi Arabia",
      zip: "21577",
    },
    joinedAt: "2023-01-10",
    lastActiveAt: "2024-06-01T07:45:00Z",
    permissions: ["reservations", "contacts"],
  },
  {
    id: "usr_004",
    firstName: "Fatima",
    lastName: "Al-Zahrani",
    fullName: { en: "Fatima Al-Zahrani", ar: "فاطمة الزهراني" },
    email: "fatima.zahrani@hotel.com",
    phone: "+966 56 456 7890",
    avatar: "https://i.pravatar.cc/150?img=9",
    role: "accountant",
    roleLabel: { en: "Accountant", ar: "محاسب" },
    department: { en: "Finance", ar: "المالية" },
    status: "active",
    address: {
      street: "22 Prince Sultan Road",
      city: "Dammam",
      country: "Saudi Arabia",
      zip: "32245",
    },
    joinedAt: "2022-08-05",
    lastActiveAt: "2024-05-31T16:00:00Z",
    permissions: ["accounting", "reports"],
  },
  {
    id: "usr_005",
    firstName: "Khalid",
    lastName: "Al-Ghamdi",
    fullName: { en: "Khalid Al-Ghamdi", ar: "خالد الغامدي" },
    email: "khalid.ghamdi@hotel.com",
    phone: "+966 58 567 8901",
    avatar: "https://i.pravatar.cc/150?img=15",
    role: "housekeeping",
    roleLabel: { en: "Housekeeping", ar: "التدبير المنزلي" },
    department: { en: "Operations", ar: "العمليات" },
    status: "inactive",
    address: {
      street: "9 Al Madinah Road",
      city: "Mecca",
      country: "Saudi Arabia",
      zip: "24231",
    },
    joinedAt: "2023-05-15",
    lastActiveAt: "2024-05-20T11:00:00Z",
    permissions: ["rooms"],
  },
  {
    id: "usr_006",
    firstName: "Layla",
    lastName: "Al-Harbi",
    fullName: { en: "Layla Al-Harbi", ar: "ليلى الحربي" },
    email: "layla.harbi@hotel.com",
    phone: "+966 59 678 9012",
    avatar: "https://i.pravatar.cc/150?img=20",
    role: "receptionist",
    roleLabel: { en: "Receptionist", ar: "موظف استقبال" },
    department: { en: "Front Office", ar: "الاستقبال" },
    status: "pending",
    address: {
      street: "31 Al Hamra District",
      city: "Riyadh",
      country: "Saudi Arabia",
      zip: "12347",
    },
    joinedAt: "2024-05-28",
    lastActiveAt: "2024-05-29T10:00:00Z",
    permissions: ["reservations"],
  },
  {
    id: "usr_007",
    firstName: "Omar",
    lastName: "Abdallah",
    fullName: { en: "Omar Abdallah", ar: "عمر عبدالله" },
    email: "omar.abdallah@hotel.com",
    phone: "+966 50 789 0123",
    avatar: "https://i.pravatar.cc/150?img=18",
    role: "admin",
    roleLabel: { en: "Admin", ar: "مدير نظام" },
    department: { en: "IT", ar: "تقنية المعلومات" },
    status: "active",
    address: {
      street: "55 Digital Valley",
      city: "Riyadh",
      country: "Saudi Arabia",
      zip: "12348",
    },
    joinedAt: "2022-06-01",
    lastActiveAt: "2024-06-01T10:00:00Z",
    permissions: ["users", "settings", "logs"],
  },
  {
    id: "usr_008",
    firstName: "Noura",
    lastName: "Al-Shehri",
    fullName: { en: "Noura Al-Shehri", ar: "نورة الشهري" },
    email: "noura.shehri@hotel.com",
    phone: "+966 55 890 1234",
    avatar: "https://i.pravatar.cc/150?img=25",
    role: "manager",
    roleLabel: { en: "Manager", ar: "مدير" },
    department: { en: "Food & Beverage", ar: "الأغذية والمشروبات" },
    status: "active",
    address: {
      street: "14 Corniche Road",
      city: "Jeddah",
      country: "Saudi Arabia",
      zip: "21578",
    },
    joinedAt: "2021-11-20",
    lastActiveAt: "2024-06-01T08:00:00Z",
    permissions: ["contacts", "reports", "inventory"],
  },
];
```

---

## contacts.data.ts

```ts
export const CONTACTS_DATA: Contact[] = [
  {
    id: "con_001",
    firstName: "James",
    lastName: "Anderson",
    fullName: { en: "James Anderson", ar: "جيمس أندرسون" },
    email: "james.anderson@email.com",
    phone: "+1 212 555 0101",
    avatar: "https://i.pravatar.cc/150?img=30",
    type: "vip",
    typeLabel: { en: "VIP", ar: "ضيف مميز" },
    company: "Anderson Enterprises",
    status: "active",
    address: {
      street: "500 Park Avenue",
      city: "New York",
      country: "United States",
      zip: "10022",
    },
    nationality: { en: "American", ar: "أمريكي" },
    passportNumber: "US123456789",
    totalStays: 24,
    totalSpent: 48750,
    lastVisit: "2024-05-15",
    createdAt: "2020-03-10",
    notes: "Prefers suite on high floors. Allergic to feathers.",
  },
  {
    id: "con_002",
    firstName: "Sophie",
    lastName: "Laurent",
    fullName: { en: "Sophie Laurent", ar: "صوفي لوران" },
    email: "sophie.laurent@corp.fr",
    phone: "+33 6 12 34 56 78",
    avatar: "https://i.pravatar.cc/150?img=32",
    type: "corporate",
    typeLabel: { en: "Corporate", ar: "شركات" },
    company: "Laurent & Associates",
    status: "active",
    address: {
      street: "12 Rue de Rivoli",
      city: "Paris",
      country: "France",
      zip: "75001",
    },
    nationality: { en: "French", ar: "فرنسي" },
    passportNumber: "FR987654321",
    totalStays: 12,
    totalSpent: 22400,
    lastVisit: "2024-04-22",
    createdAt: "2021-07-14",
    notes: "Monthly corporate visit. Needs invoice for each stay.",
  },
  {
    id: "con_003",
    firstName: "Ali",
    lastName: "Al-Mansouri",
    fullName: { en: "Ali Al-Mansouri", ar: "علي المنصوري" },
    email: "ali.mansouri@uae.ae",
    phone: "+971 50 123 4567",
    avatar: "https://i.pravatar.cc/150?img=33",
    type: "vip",
    typeLabel: { en: "VIP", ar: "ضيف مميز" },
    company: "Al-Mansouri Group",
    status: "active",
    address: {
      street: "Sheikh Zayed Road",
      city: "Dubai",
      country: "UAE",
      zip: "00000",
    },
    nationality: { en: "Emirati", ar: "إماراتي" },
    passportNumber: "AE456789012",
    totalStays: 18,
    totalSpent: 67200,
    lastVisit: "2024-05-30",
    createdAt: "2019-11-05",
    notes: "Presidential suite required. Private check-in preferred.",
  },
  {
    id: "con_004",
    firstName: "Emily",
    lastName: "Chen",
    fullName: { en: "Emily Chen", ar: "إيميلي تشن" },
    email: "emily.chen@techco.com",
    phone: "+86 138 0000 1234",
    avatar: "https://i.pravatar.cc/150?img=40",
    type: "corporate",
    typeLabel: { en: "Corporate", ar: "شركات" },
    company: "TechCo Asia",
    status: "active",
    address: {
      street: "88 Nanjing Road",
      city: "Shanghai",
      country: "China",
      zip: "200000",
    },
    nationality: { en: "Chinese", ar: "صيني" },
    passportNumber: "CN789012345",
    totalStays: 7,
    totalSpent: 14800,
    lastVisit: "2024-03-18",
    createdAt: "2022-09-01",
    notes: "Requires vegetarian meals. Late check-out preferred.",
  },
  {
    id: "con_005",
    firstName: "Carlos",
    lastName: "Rodriguez",
    fullName: { en: "Carlos Rodriguez", ar: "كارلوس رودريغيز" },
    email: "carlos.r@business.es",
    phone: "+34 91 234 5678",
    avatar: "https://i.pravatar.cc/150?img=50",
    type: "guest",
    typeLabel: { en: "Guest", ar: "ضيف" },
    company: "",
    status: "active",
    address: {
      street: "Gran Via 45",
      city: "Madrid",
      country: "Spain",
      zip: "28013",
    },
    nationality: { en: "Spanish", ar: "إسباني" },
    passportNumber: "ES345678901",
    totalStays: 3,
    totalSpent: 4200,
    lastVisit: "2024-02-14",
    createdAt: "2023-02-10",
    notes: "",
  },
  {
    id: "con_006",
    firstName: "Aisha",
    lastName: "Al-Farsi",
    fullName: { en: "Aisha Al-Farsi", ar: "عائشة الفارسي" },
    email: "aisha.farsi@oman.om",
    phone: "+968 9123 4567",
    avatar: "https://i.pravatar.cc/150?img=44",
    type: "vip",
    typeLabel: { en: "VIP", ar: "ضيف مميز" },
    company: "Al-Farsi Investments",
    status: "active",
    address: {
      street: "Muscat Bay Road",
      city: "Muscat",
      country: "Oman",
      zip: "100",
    },
    nationality: { en: "Omani", ar: "عُماني" },
    passportNumber: "OM234567890",
    totalStays: 9,
    totalSpent: 31500,
    lastVisit: "2024-05-01",
    createdAt: "2021-04-20",
    notes: "Brings family. Adjoining rooms required.",
  },
  {
    id: "con_007",
    firstName: "Luca",
    lastName: "Bianchi",
    fullName: { en: "Luca Bianchi", ar: "لوكا بيانكي" },
    email: "luca.bianchi@italy.it",
    phone: "+39 06 1234 5678",
    avatar: "https://i.pravatar.cc/150?img=60",
    type: "agency",
    typeLabel: { en: "Agency", ar: "وكالة سفر" },
    company: "Bianchi Travel Agency",
    status: "active",
    address: {
      street: "Via Veneto 10",
      city: "Rome",
      country: "Italy",
      zip: "00187",
    },
    nationality: { en: "Italian", ar: "إيطالي" },
    passportNumber: "IT567890123",
    totalStays: 31,
    totalSpent: 89400,
    lastVisit: "2024-05-20",
    createdAt: "2019-06-15",
    notes: "Books group reservations. Needs group discount.",
  },
  {
    id: "con_008",
    firstName: "Yuki",
    lastName: "Tanaka",
    fullName: { en: "Yuki Tanaka", ar: "يوكي تاناكا" },
    email: "yuki.tanaka@japan.jp",
    phone: "+81 3 1234 5678",
    avatar: "https://i.pravatar.cc/150?img=65",
    type: "guest",
    typeLabel: { en: "Guest", ar: "ضيف" },
    company: "",
    status: "inactive",
    address: {
      street: "1-1 Shinjuku",
      city: "Tokyo",
      country: "Japan",
      zip: "160-0022",
    },
    nationality: { en: "Japanese", ar: "ياباني" },
    passportNumber: "JP678901234",
    totalStays: 2,
    totalSpent: 3800,
    lastVisit: "2023-12-25",
    createdAt: "2023-12-01",
    notes: "First visit during holidays.",
  },
];
```

---

## reservations.data.ts

```ts
export const ROOMS_DATA: Room[] = [
  {
    id: "room_101",
    number: "101",
    type: "single",
    typeLabel: { en: "Single Room", ar: "غرفة مفردة" },
    floor: 1,
    capacity: 1,
    pricePerNight: 150,
    currency: "USD",
    amenities: [
      { en: "WiFi", ar: "واي فاي" },
      { en: "TV", ar: "تلفزيون" },
      { en: "Air Conditioning", ar: "تكييف" },
    ],
    status: "active",
  },
  {
    id: "room_205",
    number: "205",
    type: "double",
    typeLabel: { en: "Double Room", ar: "غرفة مزدوجة" },
    floor: 2,
    capacity: 2,
    pricePerNight: 220,
    currency: "USD",
    amenities: [
      { en: "WiFi", ar: "واي فاي" },
      { en: "TV", ar: "تلفزيون" },
      { en: "Mini Bar", ar: "ميني بار" },
      { en: "Air Conditioning", ar: "تكييف" },
    ],
    status: "active",
  },
  {
    id: "room_310",
    number: "310",
    type: "suite",
    typeLabel: { en: "Suite", ar: "جناح" },
    floor: 3,
    capacity: 3,
    pricePerNight: 450,
    currency: "USD",
    amenities: [
      { en: "WiFi", ar: "واي فاي" },
      { en: "TV", ar: "تلفزيون" },
      { en: "Mini Bar", ar: "ميني بار" },
      { en: "Jacuzzi", ar: "جاكوزي" },
      { en: "Living Room", ar: "غرفة معيشة" },
    ],
    status: "active",
  },
  {
    id: "room_412",
    number: "412",
    type: "deluxe",
    typeLabel: { en: "Deluxe Room", ar: "غرفة ديلوكس" },
    floor: 4,
    capacity: 2,
    pricePerNight: 320,
    currency: "USD",
    amenities: [
      { en: "WiFi", ar: "واي فاي" },
      { en: "Smart TV", ar: "تلفزيون ذكي" },
      { en: "Mini Bar", ar: "ميني بار" },
      { en: "Sea View", ar: "إطلالة بحرية" },
    ],
    status: "active",
  },
  {
    id: "room_501",
    number: "501",
    type: "presidential",
    typeLabel: { en: "Presidential Suite", ar: "الجناح الرئاسي" },
    floor: 5,
    capacity: 6,
    pricePerNight: 1200,
    currency: "USD",
    amenities: [
      { en: "WiFi", ar: "واي فاي" },
      { en: "Smart TV", ar: "تلفزيون ذكي" },
      { en: "Full Bar", ar: "بار كامل" },
      { en: "Private Pool", ar: "مسبح خاص" },
      { en: "Butler Service", ar: "خدمة خاصة" },
      { en: "Panoramic View", ar: "إطلالة بانورامية" },
    ],
    status: "active",
  },
];

export const RESERVATIONS_DATA: Reservation[] = [
  {
    id: "res_001",
    confirmationCode: "HTL-2024-00142",
    guestId: "con_001",
    guestName: { en: "James Anderson", ar: "جيمس أندرسون" },
    guestEmail: "james.anderson@email.com",
    guestPhone: "+1 212 555 0101",
    guestAvatar: "https://i.pravatar.cc/150?img=30",
    room: ROOMS_DATA[2],
    checkIn: "2024-06-05",
    checkOut: "2024-06-10",
    nights: 5,
    adults: 2,
    children: 0,
    status: "active",
    paymentStatus: "paid",
    totalAmount: 2250,
    paidAmount: 2250,
    currency: "USD",
    specialRequests: "High floor preferred. Extra pillows.",
    source: "direct",
    createdAt: "2024-05-20T10:30:00Z",
    updatedAt: "2024-05-20T10:30:00Z",
  },
  {
    id: "res_002",
    confirmationCode: "HTL-2024-00143",
    guestId: "con_002",
    guestName: { en: "Sophie Laurent", ar: "صوفي لوران" },
    guestEmail: "sophie.laurent@corp.fr",
    guestPhone: "+33 6 12 34 56 78",
    guestAvatar: "https://i.pravatar.cc/150?img=32",
    room: ROOMS_DATA[3],
    checkIn: "2024-06-08",
    checkOut: "2024-06-12",
    nights: 4,
    adults: 1,
    children: 0,
    status: "pending",
    paymentStatus: "partial",
    totalAmount: 1280,
    paidAmount: 640,
    currency: "USD",
    specialRequests: "Corporate invoice required.",
    source: "booking.com",
    createdAt: "2024-05-25T14:00:00Z",
    updatedAt: "2024-05-25T14:00:00Z",
  },
  {
    id: "res_003",
    confirmationCode: "HTL-2024-00144",
    guestId: "con_003",
    guestName: { en: "Ali Al-Mansouri", ar: "علي المنصوري" },
    guestEmail: "ali.mansouri@uae.ae",
    guestPhone: "+971 50 123 4567",
    guestAvatar: "https://i.pravatar.cc/150?img=33",
    room: ROOMS_DATA[4],
    checkIn: "2024-06-01",
    checkOut: "2024-06-07",
    nights: 6,
    adults: 4,
    children: 2,
    status: "active",
    paymentStatus: "paid",
    totalAmount: 7200,
    paidAmount: 7200,
    currency: "USD",
    specialRequests: "Private check-in. Flowers in room.",
    source: "direct",
    createdAt: "2024-05-10T09:00:00Z",
    updatedAt: "2024-05-10T09:00:00Z",
  },
  {
    id: "res_004",
    confirmationCode: "HTL-2024-00145",
    guestId: "con_004",
    guestName: { en: "Emily Chen", ar: "إيميلي تشن" },
    guestEmail: "emily.chen@techco.com",
    guestPhone: "+86 138 0000 1234",
    guestAvatar: "https://i.pravatar.cc/150?img=40",
    room: ROOMS_DATA[1],
    checkIn: "2024-06-15",
    checkOut: "2024-06-18",
    nights: 3,
    adults: 1,
    children: 0,
    status: "pending",
    paymentStatus: "unpaid",
    totalAmount: 660,
    paidAmount: 0,
    currency: "USD",
    specialRequests: "Vegetarian meals. Late checkout.",
    source: "expedia",
    createdAt: "2024-05-30T11:00:00Z",
    updatedAt: "2024-05-30T11:00:00Z",
  },
  {
    id: "res_005",
    confirmationCode: "HTL-2024-00146",
    guestId: "con_005",
    guestName: { en: "Carlos Rodriguez", ar: "كارلوس رودريغيز" },
    guestEmail: "carlos.r@business.es",
    guestPhone: "+34 91 234 5678",
    guestAvatar: "https://i.pravatar.cc/150?img=50",
    room: ROOMS_DATA[0],
    checkIn: "2024-05-28",
    checkOut: "2024-05-31",
    nights: 3,
    adults: 1,
    children: 0,
    status: "completed",
    paymentStatus: "paid",
    totalAmount: 450,
    paidAmount: 450,
    currency: "USD",
    specialRequests: "",
    source: "airbnb",
    createdAt: "2024-05-15T08:00:00Z",
    updatedAt: "2024-05-31T12:00:00Z",
  },
  {
    id: "res_006",
    confirmationCode: "HTL-2024-00147",
    guestId: "con_006",
    guestName: { en: "Aisha Al-Farsi", ar: "عائشة الفارسي" },
    guestEmail: "aisha.farsi@oman.om",
    guestPhone: "+968 9123 4567",
    guestAvatar: "https://i.pravatar.cc/150?img=44",
    room: ROOMS_DATA[2],
    checkIn: "2024-06-20",
    checkOut: "2024-06-25",
    nights: 5,
    adults: 2,
    children: 3,
    status: "pending",
    paymentStatus: "partial",
    totalAmount: 2250,
    paidAmount: 1000,
    currency: "USD",
    specialRequests: "Adjoining room needed. Baby cot required.",
    source: "phone",
    createdAt: "2024-05-28T15:00:00Z",
    updatedAt: "2024-05-28T15:00:00Z",
  },
  {
    id: "res_007",
    confirmationCode: "HTL-2024-00148",
    guestId: "con_007",
    guestName: { en: "Luca Bianchi", ar: "لوكا بيانكي" },
    guestEmail: "luca.bianchi@italy.it",
    guestPhone: "+39 06 1234 5678",
    guestAvatar: "https://i.pravatar.cc/150?img=60",
    room: ROOMS_DATA[1],
    checkIn: "2024-07-01",
    checkOut: "2024-07-08",
    nights: 7,
    adults: 2,
    children: 0,
    status: "pending",
    paymentStatus: "unpaid",
    totalAmount: 1540,
    paidAmount: 0,
    currency: "USD",
    specialRequests: "Group discount applied.",
    source: "direct",
    createdAt: "2024-06-01T09:00:00Z",
    updatedAt: "2024-06-01T09:00:00Z",
  },
  {
    id: "res_008",
    confirmationCode: "HTL-2024-00149",
    guestId: "con_008",
    guestName: { en: "Yuki Tanaka", ar: "يوكي تاناكا" },
    guestEmail: "yuki.tanaka@japan.jp",
    guestPhone: "+81 3 1234 5678",
    guestAvatar: "https://i.pravatar.cc/150?img=65",
    room: ROOMS_DATA[0],
    checkIn: "2024-05-01",
    checkOut: "2024-05-05",
    nights: 4,
    adults: 1,
    children: 0,
    status: "cancelled",
    paymentStatus: "refunded",
    totalAmount: 600,
    paidAmount: 0,
    currency: "USD",
    specialRequests: "",
    source: "booking.com",
    createdAt: "2024-04-20T10:00:00Z",
    updatedAt: "2024-04-25T10:00:00Z",
  },
];
```

---

## accounting.data.ts

```ts
export const TRANSACTIONS_DATA: Transaction[] = [
  {
    id: "txn_001",
    referenceNumber: "TXN-2024-0501",
    type: "payment",
    typeLabel: { en: "Payment", ar: "دفع" },
    category: "room_revenue",
    categoryLabel: { en: "Room Revenue", ar: "إيراد الغرف" },
    description: {
      en: "Full payment for reservation HTL-2024-00142",
      ar: "دفع كامل للحجز HTL-2024-00142",
    },
    amount: 2250,
    currency: "USD",
    reservationId: "res_001",
    guestName: { en: "James Anderson", ar: "جيمس أندرسون" },
    status: "completed",
    date: "2024-05-20",
    createdBy: "usr_002",
  },
  {
    id: "txn_002",
    referenceNumber: "TXN-2024-0502",
    type: "payment",
    typeLabel: { en: "Payment", ar: "دفع" },
    category: "room_revenue",
    categoryLabel: { en: "Room Revenue", ar: "إيراد الغرف" },
    description: {
      en: "Partial payment for reservation HTL-2024-00143",
      ar: "دفع جزئي للحجز HTL-2024-00143",
    },
    amount: 640,
    currency: "USD",
    reservationId: "res_002",
    guestName: { en: "Sophie Laurent", ar: "صوفي لوران" },
    status: "completed",
    date: "2024-05-25",
    createdBy: "usr_004",
  },
  {
    id: "txn_003",
    referenceNumber: "TXN-2024-0503",
    type: "payment",
    typeLabel: { en: "Payment", ar: "دفع" },
    category: "room_revenue",
    categoryLabel: { en: "Room Revenue", ar: "إيراد الغرف" },
    description: {
      en: "Full payment for presidential suite HTL-2024-00144",
      ar: "دفع كامل للجناح الرئاسي HTL-2024-00144",
    },
    amount: 7200,
    currency: "USD",
    reservationId: "res_003",
    guestName: { en: "Ali Al-Mansouri", ar: "علي المنصوري" },
    status: "completed",
    date: "2024-05-10",
    createdBy: "usr_004",
  },
  {
    id: "txn_004",
    referenceNumber: "TXN-2024-0504",
    type: "expense",
    typeLabel: { en: "Expense", ar: "مصروف" },
    category: "maintenance",
    categoryLabel: { en: "Maintenance", ar: "صيانة" },
    description: {
      en: "HVAC system maintenance - Floor 3",
      ar: "صيانة نظام تكييف الهواء - الطابق الثالث",
    },
    amount: 1800,
    currency: "USD",
    status: "completed",
    date: "2024-05-22",
    createdBy: "usr_001",
  },
  {
    id: "txn_005",
    referenceNumber: "TXN-2024-0505",
    type: "expense",
    typeLabel: { en: "Expense", ar: "مصروف" },
    category: "salary",
    categoryLabel: { en: "Salary", ar: "رواتب" },
    description: {
      en: "Monthly staff salaries - May 2024",
      ar: "رواتب الموظفين الشهرية - مايو 2024",
    },
    amount: 42000,
    currency: "USD",
    status: "completed",
    date: "2024-05-31",
    createdBy: "usr_001",
  },
  {
    id: "txn_006",
    referenceNumber: "TXN-2024-0506",
    type: "refund",
    typeLabel: { en: "Refund", ar: "استرداد" },
    category: "room_revenue",
    categoryLabel: { en: "Room Revenue", ar: "إيراد الغرف" },
    description: {
      en: "Refund for cancelled reservation HTL-2024-00149",
      ar: "استرداد للحجز الملغى HTL-2024-00149",
    },
    amount: 600,
    currency: "USD",
    reservationId: "res_008",
    guestName: { en: "Yuki Tanaka", ar: "يوكي تاناكا" },
    status: "completed",
    date: "2024-04-25",
    createdBy: "usr_004",
  },
  {
    id: "txn_007",
    referenceNumber: "TXN-2024-0507",
    type: "expense",
    typeLabel: { en: "Expense", ar: "مصروف" },
    category: "utilities",
    categoryLabel: { en: "Utilities", ar: "المرافق" },
    description: {
      en: "Electricity and water - May 2024",
      ar: "الكهرباء والماء - مايو 2024",
    },
    amount: 8500,
    currency: "USD",
    status: "completed",
    date: "2024-05-31",
    createdBy: "usr_004",
  },
  {
    id: "txn_008",
    referenceNumber: "TXN-2024-0508",
    type: "payment",
    typeLabel: { en: "Payment", ar: "دفع" },
    category: "food_beverage",
    categoryLabel: { en: "Food & Beverage", ar: "الأغذية والمشروبات" },
    description: {
      en: "Restaurant revenue - Week 22",
      ar: "إيرادات المطعم - الأسبوع 22",
    },
    amount: 12400,
    currency: "USD",
    status: "completed",
    date: "2024-05-31",
    createdBy: "usr_008",
  },
  {
    id: "txn_009",
    referenceNumber: "TXN-2024-0509",
    type: "invoice",
    typeLabel: { en: "Invoice", ar: "فاتورة" },
    category: "room_revenue",
    categoryLabel: { en: "Room Revenue", ar: "إيراد الغرف" },
    description: {
      en: "Corporate invoice for Sophie Laurent",
      ar: "فاتورة شركة لصوفي لوران",
    },
    amount: 1280,
    currency: "USD",
    reservationId: "res_002",
    guestName: { en: "Sophie Laurent", ar: "صوفي لوران" },
    status: "pending",
    date: "2024-05-25",
    createdBy: "usr_004",
  },
  {
    id: "txn_010",
    referenceNumber: "TXN-2024-0510",
    type: "expense",
    typeLabel: { en: "Expense", ar: "مصروف" },
    category: "marketing",
    categoryLabel: { en: "Marketing", ar: "التسويق" },
    description: {
      en: "Digital marketing campaign - June",
      ar: "حملة التسويق الرقمي - يونيو",
    },
    amount: 3200,
    currency: "USD",
    status: "pending",
    date: "2024-06-01",
    createdBy: "usr_001",
  },
];

export const INVOICES_DATA: Invoice[] = [
  {
    id: "inv_001",
    invoiceNumber: "INV-2024-0201",
    reservationId: "res_001",
    guestName: { en: "James Anderson", ar: "جيمس أندرسون" },
    guestEmail: "james.anderson@email.com",
    items: [
      {
        id: "item_001",
        description: { en: "Suite Room - 5 nights", ar: "جناح - 5 ليالٍ" },
        quantity: 5,
        unitPrice: 450,
        total: 2250,
      },
    ],
    subtotal: 2250,
    tax: 337.5,
    total: 2587.5,
    currency: "USD",
    status: "paid",
    issuedAt: "2024-05-20",
    dueAt: "2024-06-10",
  },
  {
    id: "inv_002",
    invoiceNumber: "INV-2024-0202",
    reservationId: "res_002",
    guestName: { en: "Sophie Laurent", ar: "صوفي لوران" },
    guestEmail: "sophie.laurent@corp.fr",
    items: [
      {
        id: "item_002",
        description: {
          en: "Deluxe Room - 4 nights",
          ar: "غرفة ديلوكس - 4 ليالٍ",
        },
        quantity: 4,
        unitPrice: 320,
        total: 1280,
      },
    ],
    subtotal: 1280,
    tax: 192,
    total: 1472,
    currency: "USD",
    status: "partial",
    issuedAt: "2024-05-25",
    dueAt: "2024-06-12",
  },
  {
    id: "inv_003",
    invoiceNumber: "INV-2024-0203",
    reservationId: "res_003",
    guestName: { en: "Ali Al-Mansouri", ar: "علي المنصوري" },
    guestEmail: "ali.mansouri@uae.ae",
    items: [
      {
        id: "item_003",
        description: {
          en: "Presidential Suite - 6 nights",
          ar: "الجناح الرئاسي - 6 ليالٍ",
        },
        quantity: 6,
        unitPrice: 1200,
        total: 7200,
      },
      {
        id: "item_004",
        description: { en: "Butler Service", ar: "خدمة خاصة" },
        quantity: 1,
        unitPrice: 500,
        total: 500,
      },
    ],
    subtotal: 7700,
    tax: 1155,
    total: 8855,
    currency: "USD",
    status: "paid",
    issuedAt: "2024-05-10",
    dueAt: "2024-06-07",
  },
];
```

---

## analytics.data.ts

```ts
export const USERS_ANALYTICS: ModuleAnalytics = {
  cards: [
    {
      id: "ua_001",
      label: { en: "Total Users", ar: "إجمالي المستخدمين" },
      value: 8,
      formattedValue: "8",
      trend: {
        value: 14,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "Users",
      suffix: "",
    },
    {
      id: "ua_002",
      label: { en: "Active Users", ar: "المستخدمون النشطون" },
      value: 6,
      formattedValue: "6",
      trend: {
        value: 20,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "UserCheck",
      suffix: "",
    },
    {
      id: "ua_003",
      label: { en: "Pending Approvals", ar: "بانتظار الموافقة" },
      value: 1,
      formattedValue: "1",
      trend: {
        value: 0,
        direction: "neutral",
        label: { en: "no change", ar: "لا تغيير" },
      },
      icon: "Clock",
      suffix: "",
    },
    {
      id: "ua_004",
      label: { en: "Departments", ar: "الأقسام" },
      value: 5,
      formattedValue: "5",
      trend: {
        value: 0,
        direction: "neutral",
        label: { en: "stable", ar: "مستقر" },
      },
      icon: "Building",
      suffix: "",
    },
  ],
  chartData: [
    { label: "Jan", value: 4, date: "2024-01-01" },
    { label: "Feb", value: 5, date: "2024-02-01" },
    { label: "Mar", value: 5, date: "2024-03-01" },
    { label: "Apr", value: 6, date: "2024-04-01" },
    { label: "May", value: 7, date: "2024-05-01" },
    { label: "Jun", value: 8, date: "2024-06-01" },
  ],
};

export const CONTACTS_ANALYTICS: ModuleAnalytics = {
  cards: [
    {
      id: "ca_001",
      label: { en: "Total Contacts", ar: "إجمالي جهات الاتصال" },
      value: 8,
      formattedValue: "8",
      trend: {
        value: 12,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "BookUser",
      suffix: "",
    },
    {
      id: "ca_002",
      label: { en: "VIP Guests", ar: "الضيوف المميزون" },
      value: 3,
      formattedValue: "3",
      trend: {
        value: 50,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "Star",
      suffix: "",
    },
    {
      id: "ca_003",
      label: { en: "Total Revenue", ar: "إجمالي الإيرادات" },
      value: 281850,
      formattedValue: "$281,850",
      trend: {
        value: 8,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "DollarSign",
      prefix: "$",
    },
    {
      id: "ca_004",
      label: { en: "Avg Stays / Guest", ar: "متوسط الإقامات" },
      value: 13.3,
      formattedValue: "13.3",
      trend: {
        value: 5,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "CalendarDays",
      suffix: " stays",
    },
  ],
  chartData: [
    { label: "Jan", value: 12000, date: "2024-01-01" },
    { label: "Feb", value: 18500, date: "2024-02-01" },
    { label: "Mar", value: 22400, date: "2024-03-01" },
    { label: "Apr", value: 19800, date: "2024-04-01" },
    { label: "May", value: 31200, date: "2024-05-01" },
    { label: "Jun", value: 27400, date: "2024-06-01" },
  ],
};

export const RESERVATIONS_ANALYTICS: ModuleAnalytics = {
  cards: [
    {
      id: "ra_001",
      label: { en: "Total Reservations", ar: "إجمالي الحجوزات" },
      value: 8,
      formattedValue: "8",
      trend: {
        value: 18,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "CalendarCheck",
      suffix: "",
    },
    {
      id: "ra_002",
      label: { en: "Active Now", ar: "نشطة الآن" },
      value: 2,
      formattedValue: "2",
      trend: {
        value: 0,
        direction: "neutral",
        label: { en: "same as yesterday", ar: "نفس الأمس" },
      },
      icon: "BedDouble",
      suffix: "",
    },
    {
      id: "ra_003",
      label: { en: "Occupancy Rate", ar: "نسبة الإشغال" },
      value: 68,
      formattedValue: "68%",
      trend: {
        value: 5,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "BarChart2",
      suffix: "%",
    },
    {
      id: "ra_004",
      label: { en: "Revenue", ar: "الإيرادات" },
      value: 11980,
      formattedValue: "$11,980",
      trend: {
        value: 22,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "TrendingUp",
      prefix: "$",
    },
    {
      id: "ra_005",
      label: { en: "Cancellation Rate", ar: "نسبة الإلغاء" },
      value: 12.5,
      formattedValue: "12.5%",
      trend: {
        value: 3,
        direction: "down",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "XCircle",
      suffix: "%",
    },
  ],
  chartData: [
    { label: "Jan", value: 18, date: "2024-01-01" },
    { label: "Feb", value: 24, date: "2024-02-01" },
    { label: "Mar", value: 31, date: "2024-03-01" },
    { label: "Apr", value: 27, date: "2024-04-01" },
    { label: "May", value: 38, date: "2024-05-01" },
    { label: "Jun", value: 42, date: "2024-06-01" },
  ],
};

export const ACCOUNTING_ANALYTICS: ModuleAnalytics = {
  cards: [
    {
      id: "acc_001",
      label: { en: "Total Revenue", ar: "إجمالي الإيرادات" },
      value: 22490,
      formattedValue: "$22,490",
      trend: {
        value: 15,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "TrendingUp",
      prefix: "$",
    },
    {
      id: "acc_002",
      label: { en: "Total Expenses", ar: "إجمالي المصروفات" },
      value: 55500,
      formattedValue: "$55,500",
      trend: {
        value: 4,
        direction: "up",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "Receipt",
      prefix: "$",
    },
    {
      id: "acc_003",
      label: { en: "Pending Invoices", ar: "الفواتير المعلقة" },
      value: 2,
      formattedValue: "2",
      trend: {
        value: 1,
        direction: "down",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "FileText",
      suffix: "",
    },
    {
      id: "acc_004",
      label: { en: "Net Profit", ar: "صافي الربح" },
      value: -33010,
      formattedValue: "-$33,010",
      trend: {
        value: 8,
        direction: "down",
        label: { en: "vs last month", ar: "مقارنة بالشهر الماضي" },
      },
      icon: "PiggyBank",
      prefix: "$",
    },
  ],
  chartData: [
    { label: "Jan", value: 18000, date: "2024-01-01" },
    { label: "Feb", value: 21000, date: "2024-02-01" },
    { label: "Mar", value: 19500, date: "2024-03-01" },
    { label: "Apr", value: 24000, date: "2024-04-01" },
    { label: "May", value: 20800, date: "2024-05-01" },
    { label: "Jun", value: 22490, date: "2024-06-01" },
  ],
};
```

---

## notifications.data.ts

```ts
export interface Notification {
  id: string;
  title: LocalizedString;
  message: LocalizedString;
  type: "info" | "warning" | "success" | "error";
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export const NOTIFICATIONS_DATA: Notification[] = [
  {
    id: "notif_001",
    title: { en: "New Reservation", ar: "حجز جديد" },
    message: {
      en: "James Anderson booked Suite 310 for 5 nights",
      ar: "جيمس أندرسون حجز الجناح 310 لمدة 5 ليالٍ",
    },
    type: "success",
    isRead: false,
    createdAt: "2024-06-01T08:30:00Z",
    link: "/reservations/res_001",
  },
  {
    id: "notif_002",
    title: { en: "Payment Pending", ar: "دفع معلق" },
    message: {
      en: "Emily Chen has an unpaid invoice of $660",
      ar: "إيميلي تشن لديها فاتورة غير مدفوعة بقيمة $660",
    },
    type: "warning",
    isRead: false,
    createdAt: "2024-06-01T09:00:00Z",
    link: "/accounting/inv_002",
  },
  {
    id: "notif_003",
    title: { en: "Check-out Today", ar: "مغادرة اليوم" },
    message: {
      en: "Carlos Rodriguez is checking out today",
      ar: "كارلوس رودريغيز يغادر اليوم",
    },
    type: "info",
    isRead: true,
    createdAt: "2024-05-31T07:00:00Z",
    link: "/reservations/res_005",
  },
  {
    id: "notif_004",
    title: { en: "Reservation Cancelled", ar: "إلغاء حجز" },
    message: {
      en: "Yuki Tanaka cancelled reservation HTL-2024-00149",
      ar: "يوكي تاناكا ألغى الحجز HTL-2024-00149",
    },
    type: "error",
    isRead: true,
    createdAt: "2024-04-25T10:00:00Z",
    link: "/reservations/res_008",
  },
  {
    id: "notif_005",
    title: { en: "New User Added", ar: "مستخدم جديد" },
    message: {
      en: "Layla Al-Harbi joined as Receptionist",
      ar: "ليلى الحربي انضمت كموظفة استقبال",
    },
    type: "info",
    isRead: false,
    createdAt: "2024-05-28T14:00:00Z",
    link: "/users/usr_006",
  },
];
```

---

## sidebar.data.ts

```ts
export interface SidebarItem {
  id: string;
  label: LocalizedString;
  icon: string;
  href: string;
  badge?: number;
  children?: SidebarItem[];
}

export const SIDEBAR_DATA: SidebarItem[] = [
  {
    id: "dashboard",
    label: { en: "Dashboard", ar: "لوحة التحكم" },
    icon: "LayoutDashboard",
    href: "/dashboard",
  },
  {
    id: "reservations",
    label: { en: "Reservations", ar: "الحجوزات" },
    icon: "CalendarCheck",
    href: "/reservations",
    badge: 3,
  },
  {
    id: "contacts",
    label: { en: "Contacts", ar: "جهات الاتصال" },
    icon: "BookUser",
    href: "/contacts",
  },
  {
    id: "users",
    label: { en: "Users", ar: "المستخدمون" },
    icon: "Users",
    href: "/users",
  },
  {
    id: "accounting",
    label: { en: "Accounting", ar: "المحاسبة" },
    icon: "Receipt",
    href: "/accounting",
    badge: 2,
  },
  {
    id: "settings",
    label: { en: "Settings", ar: "الإعدادات" },
    icon: "Settings",
    href: "/settings",
  },
];
```

---

## hotel.data.ts

```ts
export interface HotelInfo {
  name: LocalizedString;
  tagline: LocalizedString;
  logo: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  currency: Currency;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  totalRooms: number;
  starRating: number;
}

export const HOTEL_INFO: HotelInfo = {
  name: { en: "Grand Palace Hotel", ar: "فندق القصر الكبير" },
  tagline: {
    en: "Where luxury meets comfort",
    ar: "حيث يلتقي الفخامة بالراحة",
  },
  logo: "/logo.svg",
  address: {
    street: "1 Palace Road",
    city: "Riyadh",
    country: "Saudi Arabia",
    zip: "12211",
  },
  phone: "+966 11 000 0000",
  email: "info@grandpalace.com",
  website: "www.grandpalace.com",
  currency: "USD",
  timezone: "Asia/Riyadh",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  totalRooms: 120,
  starRating: 5,
};
```

---

## index.ts (Master Export)

```ts
// Types
export * from "./types/common.types";
export * from "./types/user.types";
export * from "./types/contact.types";
export * from "./types/reservation.types";
export * from "./types/accounting.types";
export * from "./types/analytics.types";

// Data
export { USERS_DATA } from "./users.data";
export { CONTACTS_DATA } from "./contacts.data";
export { ROOMS_DATA, RESERVATIONS_DATA } from "./reservations.data";
export { TRANSACTIONS_DATA, INVOICES_DATA } from "./accounting.data";
export {
  USERS_ANALYTICS,
  CONTACTS_ANALYTICS,
  RESERVATIONS_ANALYTICS,
  ACCOUNTING_ANALYTICS,
} from "./analytics.data";
export { NOTIFICATIONS_DATA } from "./notifications.data";
export { SIDEBAR_DATA } from "./sidebar.data";
export { HOTEL_INFO } from "./hotel.data";
```

---

# 🔒 VALIDATION CHECKLIST

Before finishing:

- [ ] All types are strictly defined
- [ ] All data files use those types
- [ ] LocalizedString used for all user-facing text
- [ ] Avatars use real placeholder URLs
- [ ] Analytics data covers all 4 modules
- [ ] Sidebar data has icons matching Lucide names
- [ ] No hardcoded strings outside LocalizedString
- [ ] index.ts exports everything cleanly
- [ ] Data is realistic and hotel-specific

---

# 🚫 FORBIDDEN

```
❌ Random or lorem ipsum data
❌ Missing Arabic translations
❌ Inconsistent IDs
❌ Using 'any' type in TypeScript
❌ Missing trend direction
❌ Avatars without real URLs
❌ Data that doesn't match the types
```

---

# 🧾 OUTPUT EXPECTED

- Complete folder structure under `src/data/`
- All type files
- All data files
- Master `index.ts`
- Ready to import in any component

Stop after this step and confirm.
## MASTER GOVERNANCE (REQUIRED)

This file is part of the unified agent system in `docs/agents`. It MUST align with every other `.md` file in this directory.

Global rules:

- Approved project roots: `src/app`, `src/modules`, `src/shared`, `src/store`, `src/services`, `src/data`, `src/pwa`, `src/i18n`, `src/types`, `src/styles`, `src/components`, `src/hooks`.
- Approved production data flow: UI -> Hook -> RTK or local state -> Service -> Firestore/API.
- Approved dummy-data flow: UI -> Hook -> centralized `src/data` selectors/adapters. UI components MUST NOT import dummy arrays directly.
- Backend-ready modules MUST be swappable from dummy data to Service/API without changing UI components.
- UI implementation MUST use Tailwind only and MUST follow `ui-ux-tailwind.md`.
- User-facing text MUST use i18n translation keys or `LocalizedString`; hardcoded UI copy is STRICTLY FORBIDDEN.
- RTL MUST be supported with logical layout patterns. Directional AOS animations are STRICTLY FORBIDDEN.
- AOS rules are defined only in `ui-ux-tailwind.md`; other files MUST reference that source instead of redefining animation behavior.
- Permission rules MUST be enforced at route, UI, hook/service, and data-access boundaries.
- Loading, skeleton, empty, error, offline, permission-denied, and not-found states are REQUIRED for every module page.
- File limits are standardized: UI component max 150 lines, custom hook max 100 lines, API route max 120 lines, utility max 50 lines, page max 200 lines.
## MASTER REVIEW CORRECTIONS (APPLIED)

Dummy data MUST be centralized in `src/data` and accessed only through hooks/selectors/adapters. UI components MUST NOT import raw arrays directly.

Localized data rules:

- Every user-facing data field MUST use `LocalizedString`.
- Operational notes, special requests, descriptions, labels, chart labels, notification text, sidebar labels, status labels, and analytics trend labels MUST be localized.
- Machine-only fields such as IDs, dates, email addresses, phone numbers, URLs, slugs, enum values, and currency codes MAY remain plain strings.
- Chart month labels MUST be generated through i18n/date formatting or stored as `LocalizedString`; hardcoded `"Jan"`, `"Feb"`, etc. are NOT allowed in final code.

Corrected type requirements:

```ts
export interface Contact {
  notes: LocalizedString;
}

export interface Reservation {
  specialRequests: LocalizedString;
}

export interface ChartDataPoint {
  label: LocalizedString;
  value: number;
  date: string;
}
```

Permissions data requirement:

- Role permissions MUST be centralized and typed.
- Permission IDs MUST be stable strings.
- Dummy users MUST include realistic permission sets that can drive route, navigation, UI action, and data-access checks.
