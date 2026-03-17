'use client';

type Profile = {
  userId: string;
  username: string;
  email: string;
  bookId: string;
  company: string;
  status: string;
  mfaEnabled: boolean;
};

type PurchaseInvoiceListItem = {
  supplierInvoiceNo: string;
  supplier: string;
  agent: string;
  currency: string;
  date: string;
  grandTotal: number;
  amount: number;
  invoiceNo: string;
};

type CreditorListItem = {
  code: string;
  companyName: string;
  currency: string;
  type: string;
  phone: string;
  area: string;
  agent: string;
  active: boolean;
};

type StockListItem = {
  itemCode: string;
  description: string;
  desc2?: string;
  group: string;
  type: string;
  baseUom: string;
  control: boolean;
  active: boolean;
};

type AgentOption = {
  code: string;
  description: string;
};

type PreviewTaskStatus = 'queued' | 'ocr_processing' | 'analyzing' | 'succeeded' | 'failed' | 'canceled';
type SubmitTaskStatus = 'queued' | 'preparing' | 'validating' | 'dispatching' | 'succeeded' | 'failed';

type PreviewDetail = {
  itemCode: string;
  description: string;
  desc2: string;
  qty: number;
  unitPrice: number;
  amount: number;
  uom: string;
  taxCode: string;
  accNo: string;
  itemGroup: string;
};

type PreviewPayload = {
  creditorCode: string;
  purchaseAgent: string;
  supplierInvoiceNo: string;
  externalLink?: string;
  docDate: string;
  currencyCode: string;
  currencyRate: number;
  displayTerm: string;
  purchaseLocation: string;
  description: string;
  creditorAddressLines: string[];
  details: PreviewDetail[];
};

type PreviewResponse = {
  taskId?: string;
  success?: boolean;
  payload: PreviewPayload;
  warnings: Array<string | Record<string, unknown>>;
  file?: {
    fileId: string;
    status: string;
    downloadUrl?: string;
    originalName?: string;
    contentType?: string;
    size?: number;
  };
  matches: Record<string, unknown>;
  extracted?: Record<string, unknown>;
  provider?: string;
  sourceFileName?: string;
  bookId?: string;
  company?: string;
};

type PreviewTask = {
  taskId: string;
  createdAt: number;
  canceled: boolean;
  result: PreviewResponse;
};

type SubmitTaskResponse = {
  success: boolean;
  requestId: string;
  bookId?: string;
  company?: string;
  message?: string;
  finalPayload?: Record<string, unknown>;
  stockCreates?: Array<Record<string, unknown>>;
  creditorCreate?: Record<string, unknown> | null;
  purchaseInvoice?: Record<string, unknown> | null;
};

type SubmitTask = {
  taskId: string;
  requestId: string;
  previewTaskId: string;
  createdAt: number;
  completed: boolean;
  result: SubmitTaskResponse;
};

const STORAGE_KEYS = {
  invoices: 'mock:purchase-invoices',
  previewTasks: 'mock:preview-tasks',
  submitTasks: 'mock:submit-tasks',
};

const BOOK_ID = 'MOCK-BOOK-001';
const COMPANY = '365BIZ Trading Sdn. Bhd.';
const PREVIEW_TIMINGS = {
  queued: 500,
  ocr: 1300,
  analyzing: 2400,
};
const SUBMIT_TIMINGS = {
  queued: 500,
  preparing: 1200,
  validating: 2200,
  dispatching: 3200,
};

export const mockProfile: Profile = {
  userId: 'mock-user-001',
  username: 'Demo Operator',
  email: 'demo@365biz.ai',
  bookId: BOOK_ID,
  company: COMPANY,
  status: 'active',
  mfaEnabled: false,
};

const mockAgents: AgentOption[] = [
  { code: 'AG001', description: 'Alicia Tan' },
  { code: 'AG002', description: 'Marcus Lee' },
  { code: 'AG003', description: 'Nur Aisyah' },
  { code: 'AG004', description: 'Darren Wong' },
  { code: 'AG005', description: 'Shafiq Rahman' },
];

const mockCreditors: CreditorListItem[] = [
  { code: 'CRD-1001', companyName: 'Alpha Packaging Supplies', currency: 'MYR', type: 'LOCAL', phone: '03-5521 1001', area: 'Shah Alam', agent: 'AG001', active: true },
  { code: 'CRD-1002', companyName: 'Beacon Office Products', currency: 'MYR', type: 'LOCAL', phone: '03-3344 2288', area: 'Klang', agent: 'AG002', active: true },
  { code: 'CRD-1003', companyName: 'Crest Wholesale Foods', currency: 'MYR', type: 'LOCAL', phone: '03-7788 0110', area: 'PJ', agent: 'AG003', active: true },
  { code: 'CRD-1004', companyName: 'Delta Cold Chain Services', currency: 'MYR', type: 'LOCAL', phone: '03-7954 7811', area: 'Subang', agent: 'AG004', active: true },
  { code: 'CRD-1005', companyName: 'Evergreen Retail Systems', currency: 'USD', type: 'OVERSEA', phone: '603-7781 5522', area: 'KL', agent: 'AG005', active: true },
  { code: 'CRD-1006', companyName: 'Futura Cleaning Chemicals', currency: 'MYR', type: 'LOCAL', phone: '03-6123 7812', area: 'Selayang', agent: 'AG001', active: true },
  { code: 'CRD-1007', companyName: 'Global Stationery Hub', currency: 'MYR', type: 'LOCAL', phone: '03-4021 4499', area: 'Setapak', agent: 'AG002', active: false },
  { code: 'CRD-1008', companyName: 'Horizon Food Ingredients', currency: 'MYR', type: 'LOCAL', phone: '03-8062 7722', area: 'Puchong', agent: 'AG003', active: true },
  { code: 'CRD-1009', companyName: 'Ionix Lab Equipment', currency: 'SGD', type: 'OVERSEA', phone: '03-7728 6655', area: 'Ara Damansara', agent: 'AG004', active: true },
  { code: 'CRD-1010', companyName: 'Jade Hospitality Essentials', currency: 'MYR', type: 'LOCAL', phone: '03-5510 3300', area: 'PJ', agent: 'AG005', active: true },
  { code: 'CRD-1011', companyName: 'Kappa Printworks', currency: 'MYR', type: 'LOCAL', phone: '03-6273 8811', area: 'Kepong', agent: 'AG001', active: true },
  { code: 'CRD-1012', companyName: 'Luma Engineering Parts', currency: 'MYR', type: 'LOCAL', phone: '03-5621 1221', area: 'Subang', agent: 'AG002', active: true },
  { code: 'CRD-1013', companyName: 'Metro Beverage Distributors', currency: 'MYR', type: 'LOCAL', phone: '03-2141 9200', area: 'KL', agent: 'AG003', active: true },
  { code: 'CRD-1014', companyName: 'Nova Industrial Fasteners', currency: 'MYR', type: 'LOCAL', phone: '03-5542 0101', area: 'Shah Alam', agent: 'AG004', active: true },
  { code: 'CRD-1015', companyName: 'Orbit Cafe Ingredients', currency: 'MYR', type: 'LOCAL', phone: '03-7956 1200', area: 'PJ', agent: 'AG005', active: true },
  { code: 'CRD-1016', companyName: 'Prime Medical Consumables', currency: 'MYR', type: 'LOCAL', phone: '03-7845 6789', area: 'Kelana Jaya', agent: 'AG001', active: true },
  { code: 'CRD-1017', companyName: 'Quantum Auto Components', currency: 'MYR', type: 'LOCAL', phone: '03-7842 1199', area: 'Sungai Buloh', agent: 'AG002', active: true },
  { code: 'CRD-1018', companyName: 'Riverstone Textile Goods', currency: 'MYR', type: 'LOCAL', phone: '03-7988 4455', area: 'Cheras', agent: 'AG003', active: true },
  { code: 'CRD-1019', companyName: 'Summit Bakery Essentials', currency: 'MYR', type: 'LOCAL', phone: '03-8068 7766', area: 'Puchong', agent: 'AG004', active: true },
  { code: 'CRD-1020', companyName: 'Titan Safety Wear', currency: 'MYR', type: 'LOCAL', phone: '03-6201 9292', area: 'Mont Kiara', agent: 'AG005', active: true },
  { code: 'CRD-1021', companyName: 'Union Electrical Parts', currency: 'MYR', type: 'LOCAL', phone: '03-4022 1110', area: 'Setapak', agent: 'AG001', active: true },
  { code: 'CRD-1022', companyName: 'Vertex Agricultural Supply', currency: 'MYR', type: 'LOCAL', phone: '03-6157 2255', area: 'Rawang', agent: 'AG002', active: true },
  { code: 'CRD-1023', companyName: 'Westline Building Materials', currency: 'MYR', type: 'LOCAL', phone: '03-6189 7700', area: 'Selayang', agent: 'AG003', active: true },
  { code: 'CRD-1024', companyName: 'Xeno Data Devices', currency: 'USD', type: 'OVERSEA', phone: '03-2162 1188', area: 'KL', agent: 'AG004', active: true },
  { code: 'CRD-1025', companyName: 'Yotta Marine Services', currency: 'MYR', type: 'LOCAL', phone: '03-6259 1919', area: 'Klang', agent: 'AG005', active: true },
  { code: 'CRD-1026', companyName: 'Zenith Fresh Produce', currency: 'MYR', type: 'LOCAL', phone: '03-7458 2200', area: 'Semenyih', agent: 'AG001', active: true },
];

const mockStock: StockListItem[] = [
  { itemCode: 'STK-1001', description: 'A4 Copier Paper 80gsm', desc2: '500 sheets', group: 'OFFICE', type: 'INVENTORY', baseUom: 'REAM', control: true, active: true },
  { itemCode: 'STK-1002', description: 'Black Toner Cartridge', desc2: 'Laser printer', group: 'OFFICE', type: 'INVENTORY', baseUom: 'UNIT', control: true, active: true },
  { itemCode: 'STK-1003', description: 'Disposable Gloves', desc2: 'Powder free', group: 'SAFETY', type: 'INVENTORY', baseUom: 'BOX', control: true, active: true },
  { itemCode: 'STK-1004', description: 'Industrial Cleaning Liquid', desc2: '5L', group: 'CHEMICAL', type: 'INVENTORY', baseUom: 'BOTTLE', control: true, active: true },
  { itemCode: 'STK-1005', description: 'Packing Tape 48mm', desc2: 'Clear', group: 'PACKAGING', type: 'INVENTORY', baseUom: 'ROLL', control: true, active: true },
  { itemCode: 'STK-1006', description: 'Thermal Receipt Paper', desc2: '80x80', group: 'OFFICE', type: 'INVENTORY', baseUom: 'ROLL', control: true, active: true },
  { itemCode: 'STK-1007', description: 'Plastic Food Container', desc2: '750ml', group: 'PACKAGING', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1008', description: 'Curry Powder Mix', desc2: '1kg', group: 'INGREDIENT', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1009', description: 'LED Downlight 12W', desc2: 'Warm white', group: 'ELECTRICAL', type: 'INVENTORY', baseUom: 'UNIT', control: true, active: true },
  { itemCode: 'STK-1010', description: 'Hand Sanitizer', desc2: '500ml', group: 'SAFETY', type: 'INVENTORY', baseUom: 'BOTTLE', control: true, active: true },
  { itemCode: 'STK-1011', description: 'Steel Bolt M10', desc2: 'Galvanized', group: 'HARDWARE', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1012', description: 'Courier Flyer Bag', desc2: 'A4', group: 'PACKAGING', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1013', description: 'Latte Paper Cup', desc2: '12oz', group: 'FNB', type: 'INVENTORY', baseUom: 'SLEEVE', control: true, active: true },
  { itemCode: 'STK-1014', description: 'Syrup Pump Bottle', desc2: '1L', group: 'FNB', type: 'INVENTORY', baseUom: 'UNIT', control: true, active: true },
  { itemCode: 'STK-1015', description: 'Fresh Milk UHT', desc2: '1L', group: 'FNB', type: 'INVENTORY', baseUom: 'CARTON', control: true, active: true },
  { itemCode: 'STK-1016', description: 'Frozen Chicken Breast', desc2: '2kg', group: 'FROZEN', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1017', description: 'Barcode Sticker Label', desc2: '50x30', group: 'OFFICE', type: 'INVENTORY', baseUom: 'ROLL', control: true, active: true },
  { itemCode: 'STK-1018', description: 'Safety Vest Reflective', desc2: 'Orange', group: 'SAFETY', type: 'INVENTORY', baseUom: 'UNIT', control: true, active: true },
  { itemCode: 'STK-1019', description: 'PVC Pipe 1 inch', desc2: '4 meter', group: 'HARDWARE', type: 'INVENTORY', baseUom: 'UNIT', control: true, active: true },
  { itemCode: 'STK-1020', description: 'Paper Straw', desc2: 'Black', group: 'FNB', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1021', description: 'Multi Surface Cleaner', desc2: '750ml', group: 'CHEMICAL', type: 'INVENTORY', baseUom: 'BOTTLE', control: true, active: true },
  { itemCode: 'STK-1022', description: 'USB Barcode Scanner', desc2: '2D', group: 'ELECTRICAL', type: 'INVENTORY', baseUom: 'UNIT', control: false, active: true },
  { itemCode: 'STK-1023', description: 'Palm Sugar Syrup', desc2: '2kg', group: 'INGREDIENT', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1024', description: 'Foil Tray Medium', desc2: '500 pcs', group: 'PACKAGING', type: 'INVENTORY', baseUom: 'BOX', control: true, active: true },
  { itemCode: 'STK-1025', description: 'Cable Tie 8 inch', desc2: '100 pcs', group: 'HARDWARE', type: 'INVENTORY', baseUom: 'PACK', control: true, active: true },
  { itemCode: 'STK-1026', description: 'Notebook Ruled', desc2: 'A5', group: 'OFFICE', type: 'INVENTORY', baseUom: 'UNIT', control: false, active: true },
];

const seededInvoices: PurchaseInvoiceListItem[] = [
  { supplierInvoiceNo: 'PI-SUP-240301', supplier: 'Alpha Packaging Supplies', agent: 'AG001', currency: 'MYR', date: '2026-03-01', grandTotal: 820.5, amount: 774.06, invoiceNo: 'AP-INV-9021' },
  { supplierInvoiceNo: 'PI-SUP-240302', supplier: 'Beacon Office Products', agent: 'AG002', currency: 'MYR', date: '2026-03-02', grandTotal: 1290, amount: 1216.98, invoiceNo: 'AP-INV-9022' },
  { supplierInvoiceNo: 'PI-SUP-240303', supplier: 'Crest Wholesale Foods', agent: 'AG003', currency: 'MYR', date: '2026-03-03', grandTotal: 560.4, amount: 528.68, invoiceNo: 'AP-INV-9023' },
  { supplierInvoiceNo: 'PI-SUP-240304', supplier: 'Delta Cold Chain Services', agent: 'AG004', currency: 'MYR', date: '2026-03-04', grandTotal: 2400, amount: 2264.15, invoiceNo: 'AP-INV-9024' },
  { supplierInvoiceNo: 'PI-SUP-240305', supplier: 'Evergreen Retail Systems', agent: 'AG005', currency: 'USD', date: '2026-03-05', grandTotal: 415, amount: 391.51, invoiceNo: 'AP-INV-9025' },
  { supplierInvoiceNo: 'PI-SUP-240306', supplier: 'Futura Cleaning Chemicals', agent: 'AG001', currency: 'MYR', date: '2026-03-06', grandTotal: 980.3, amount: 924.81, invoiceNo: 'AP-INV-9026' },
  { supplierInvoiceNo: 'PI-SUP-240307', supplier: 'Global Stationery Hub', agent: 'AG002', currency: 'MYR', date: '2026-03-07', grandTotal: 731.2, amount: 689.81, invoiceNo: 'AP-INV-9027' },
  { supplierInvoiceNo: 'PI-SUP-240308', supplier: 'Horizon Food Ingredients', agent: 'AG003', currency: 'MYR', date: '2026-03-08', grandTotal: 1630.85, amount: 1538.58, invoiceNo: 'AP-INV-9028' },
  { supplierInvoiceNo: 'PI-SUP-240309', supplier: 'Ionix Lab Equipment', agent: 'AG004', currency: 'SGD', date: '2026-03-09', grandTotal: 2745.4, amount: 2590.1, invoiceNo: 'AP-INV-9029' },
  { supplierInvoiceNo: 'PI-SUP-240310', supplier: 'Jade Hospitality Essentials', agent: 'AG005', currency: 'MYR', date: '2026-03-10', grandTotal: 452.1, amount: 426.51, invoiceNo: 'AP-INV-9030' },
  { supplierInvoiceNo: 'PI-SUP-240311', supplier: 'Kappa Printworks', agent: 'AG001', currency: 'MYR', date: '2026-03-11', grandTotal: 1144.8, amount: 1080.0, invoiceNo: 'AP-INV-9031' },
  { supplierInvoiceNo: 'PI-SUP-240312', supplier: 'Luma Engineering Parts', agent: 'AG002', currency: 'MYR', date: '2026-03-12', grandTotal: 3900, amount: 3679.25, invoiceNo: 'AP-INV-9032' },
];

let invoiceStore: PurchaseInvoiceListItem[] | null = null;
let previewTaskStore: Record<string, PreviewTask> | null = null;
let submitTaskStore: Record<string, SubmitTask> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!storageAvailable()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!storageAvailable()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getInvoices() {
  if (!invoiceStore) {
    invoiceStore = readJson(STORAGE_KEYS.invoices, seededInvoices);
  }
  return invoiceStore;
}

function saveInvoices(nextInvoices: PurchaseInvoiceListItem[]) {
  invoiceStore = nextInvoices;
  writeJson(STORAGE_KEYS.invoices, nextInvoices);
}

function getPreviewTasks() {
  if (!previewTaskStore) {
    previewTaskStore = readJson<Record<string, PreviewTask>>(STORAGE_KEYS.previewTasks, {});
  }
  return previewTaskStore;
}

function savePreviewTasks(nextTasks: Record<string, PreviewTask>) {
  previewTaskStore = nextTasks;
  writeJson(STORAGE_KEYS.previewTasks, nextTasks);
}

function getSubmitTasks() {
  if (!submitTaskStore) {
    submitTaskStore = readJson<Record<string, SubmitTask>>(STORAGE_KEYS.submitTasks, {});
  }
  return submitTaskStore;
}

function saveSubmitTasks(nextTasks: Record<string, SubmitTask>) {
  submitTaskStore = nextTasks;
  writeJson(STORAGE_KEYS.submitTasks, nextTasks);
}

function compareValues(left: string | number | boolean, right: string | number | boolean, order: 'asc' | 'desc') {
  if (left === right) {
    return 0;
  }
  const result = left > right ? 1 : -1;
  return order === 'asc' ? result : result * -1;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safePageSize;
  const pagedItems = items.slice(start, start + safePageSize);
  const total = items.length;
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    bookId: BOOK_ID,
    company: COMPANY,
    items: pagedItems,
  };
}

function normalizeSearch(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function createPreviewResult(taskId: string, file: File): PreviewResponse {
  const creditor = mockCreditors[0];
  const agent = mockAgents[0];
  const stem = file.name.replace(/\.[^.]+$/, '').trim() || 'purchase-invoice';
  const suffix = taskId.slice(-6).toUpperCase();
  const supplierInvoiceNo = `MOCK-${suffix}`;
  const details: PreviewDetail[] = [
    {
      itemCode: mockStock[0].itemCode,
      description: mockStock[0].description,
      desc2: mockStock[0].desc2 ?? '',
      qty: 4,
      unitPrice: 42.5,
      amount: 170,
      uom: mockStock[0].baseUom,
      taxCode: 'TX',
      accNo: '500-100',
      itemGroup: mockStock[0].group,
    },
    {
      itemCode: '',
      description: 'House Blend Coffee Beans',
      desc2: '1kg pack',
      qty: 3,
      unitPrice: 58,
      amount: 174,
      uom: 'PACK',
      taxCode: 'TX',
      accNo: '500-110',
      itemGroup: '',
    },
  ];

  return {
    taskId,
    success: true,
    payload: {
      creditorCode: creditor.code,
      purchaseAgent: agent.code,
      supplierInvoiceNo,
      externalLink: `https://example.com/mock/${taskId}`,
      docDate: '2026-03-17',
      currencyCode: creditor.currency,
      currencyRate: 1,
      displayTerm: '30 DAYS',
      purchaseLocation: 'MAIN WH',
      description: `${stem} imported via mock preview`,
      creditorAddressLines: ['Lot 18 Jalan Teknologi', '47810 Petaling Jaya', 'Selangor'],
      details,
    },
    warnings: [
      {
        code: 'item_not_matched',
        message: 'Line 2 is a new item suggestion. Review it before posting.',
        line: 1,
      },
    ],
    file: {
      fileId: `file-${taskId}`,
      status: 'stored',
      originalName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    },
    matches: {
      creditor: {
        status: 'matched',
        confidence: 0.98,
        extractedValue: creditor.companyName,
        candidate: {
          code: creditor.code,
          companyName: creditor.companyName,
        },
      },
      agent: {
        status: 'matched',
        confidence: 0.96,
        extractedValue: agent.description,
        candidate: {
          code: agent.code,
          description: agent.description,
        },
      },
      items: [
        {
          status: 'matched',
          confidence: 0.94,
          extractedValue: mockStock[0].description,
          candidate: {
            itemCode: mockStock[0].itemCode,
            description: mockStock[0].description,
            itemGroup: mockStock[0].group,
          },
        },
        {
          status: 'unmatched',
          confidence: 0.74,
          extractedValue: 'House Blend Coffee Beans',
          proposedNewItem: {
            itemCodeSuggestion: `NEW-${suffix}`,
            description: 'House Blend Coffee Beans',
            desc2: '1kg pack',
            itemGroup: 'FNB',
            baseUom: 'PACK',
            salesUom: 'PACK',
            purchaseUom: 'PACK',
            reportUom: 'PACK',
            itemType: 'INVENTORY',
            stockControl: true,
            hasSerialNo: false,
            hasBatchNo: false,
            active: true,
            taxCode: 'TX',
            purchaseTaxCode: 'TX',
          },
        },
      ],
    },
    extracted: {
      creditorName: creditor.companyName,
      creditorAddressLines: ['Lot 18 Jalan Teknologi', '47810 Petaling Jaya', 'Selangor'],
      agentName: agent.description,
      invoiceNumber: supplierInvoiceNo,
      invoiceDate: '2026-03-17',
      description: `${stem} imported via mock preview`,
    },
    provider: 'mock-ai',
    sourceFileName: file.name,
    bookId: BOOK_ID,
    company: COMPANY,
  };
}

function resolvePreviewStatus(task: PreviewTask): PreviewTaskStatus {
  if (task.canceled) {
    return 'canceled';
  }
  const elapsed = Date.now() - task.createdAt;
  if (elapsed < PREVIEW_TIMINGS.queued) {
    return 'queued';
  }
  if (elapsed < PREVIEW_TIMINGS.ocr) {
    return 'ocr_processing';
  }
  if (elapsed < PREVIEW_TIMINGS.analyzing) {
    return 'analyzing';
  }
  return 'succeeded';
}

function buildSubmitResult(request: {
  requestId: string;
  previewTaskId: string;
  payload: {
    supplierInvoiceNo: string;
    creditorCode: string;
    purchaseAgent: string;
    currencyCode: string;
    docDate: string;
    details: Array<{ amount: number | string }>;
  };
  createMissing?: {
    items?: Array<{
      line: number;
      enabled: boolean;
      payload: { itemCode: string; description: string; itemGroup: string };
    }>;
  };
}) {
  const creditor = mockCreditors.find((item) => item.code === request.payload.creditorCode) ?? mockCreditors[0];
  const grandTotal = request.payload.details.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  return {
    success: true,
    requestId: request.requestId,
    bookId: BOOK_ID,
    company: COMPANY,
    message: 'Mock submit completed successfully.',
    finalPayload: request.payload,
    stockCreates:
      request.createMissing?.items?.filter((item) => item.enabled).map((item) => ({
        kind: 'stock',
        requestId: request.requestId,
        statusCode: 201,
        success: true,
        message: `Created stock ${item.payload.itemCode}`,
        response: item.payload,
      })) ?? [],
    creditorCreate: request.payload.creditorCode
      ? null
      : {
          kind: 'creditor',
          requestId: request.requestId,
          statusCode: 201,
          success: true,
          message: 'Created creditor from mock submit.',
        },
    purchaseInvoice: {
      kind: 'purchase-invoice',
      requestId: request.requestId,
      statusCode: 201,
      success: true,
      message: 'Purchase invoice posted in mock workspace.',
    },
    supplier: creditor.companyName,
    grandTotal,
  };
}

function resolveSubmitStatus(task: SubmitTask): SubmitTaskStatus {
  const elapsed = Date.now() - task.createdAt;
  if (elapsed < SUBMIT_TIMINGS.queued) {
    return 'queued';
  }
  if (elapsed < SUBMIT_TIMINGS.preparing) {
    return 'preparing';
  }
  if (elapsed < SUBMIT_TIMINGS.validating) {
    return 'validating';
  }
  if (elapsed < SUBMIT_TIMINGS.dispatching) {
    return 'dispatching';
  }
  if (!task.completed) {
    const result = task.result as SubmitTaskResponse & { finalPayload?: any; supplier?: string; grandTotal?: number };
    const invoices = getInvoices();
    const exists = invoices.some((item) => item.supplierInvoiceNo === result.finalPayload?.supplierInvoiceNo);
    if (!exists && result.finalPayload) {
      saveInvoices([
        {
          supplierInvoiceNo: result.finalPayload.supplierInvoiceNo,
          supplier: result.supplier ?? mockCreditors[0].companyName,
          agent: result.finalPayload.purchaseAgent,
          currency: result.finalPayload.currencyCode,
          date: result.finalPayload.docDate,
          grandTotal: Number(result.grandTotal ?? 0),
          amount: Number(result.grandTotal ?? 0) * 0.945,
          invoiceNo: `AP-INV-${9000 + invoices.length + 1}`,
        },
        ...invoices,
      ]);
    }
    task.completed = true;
    saveSubmitTasks({ ...getSubmitTasks(), [task.taskId]: task });
  }
  return 'succeeded';
}

export async function getMockProfile() {
  await delay(120);
  return mockProfile;
}

export async function getMockPurchaseInvoiceList(params: {
  page: number;
  pageSize: number;
  sortBy?: 'supplier' | 'agent' | 'currency' | 'date' | 'grandTotal' | 'amount' | 'invoiceNo';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  grandTotalMin?: number;
  grandTotalMax?: number;
}) {
  await delay(160);
  const search = normalizeSearch(params.search);
  const supplierSearch = normalizeSearch(params.supplier);
  const filtered = getInvoices().filter((item) => {
    if (search) {
      const haystack = `${item.supplierInvoiceNo} ${item.supplier} ${item.agent} ${item.invoiceNo}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }
    if (supplierSearch && !item.supplier.toLowerCase().includes(supplierSearch)) {
      return false;
    }
    if (params.dateFrom && item.date < params.dateFrom) {
      return false;
    }
    if (params.dateTo && item.date > params.dateTo) {
      return false;
    }
    if (typeof params.grandTotalMin === 'number' && item.grandTotal < params.grandTotalMin) {
      return false;
    }
    if (typeof params.grandTotalMax === 'number' && item.grandTotal > params.grandTotalMax) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const order = params.sortOrder ?? 'desc';
    switch (params.sortBy) {
      case 'supplier':
        return compareValues(left.supplier, right.supplier, order);
      case 'agent':
        return compareValues(left.agent, right.agent, order);
      case 'currency':
        return compareValues(left.currency, right.currency, order);
      case 'grandTotal':
        return compareValues(left.grandTotal, right.grandTotal, order);
      case 'amount':
        return compareValues(left.amount, right.amount, order);
      case 'invoiceNo':
        return compareValues(left.invoiceNo, right.invoiceNo, order);
      case 'date':
      default:
        return compareValues(left.date, right.date, order);
    }
  });

  return paginate(sorted, params.page, params.pageSize);
}

export async function getMockCreditorList(params: {
  page: number;
  pageSize: number;
  sortBy?: 'code' | 'companyName' | 'currency' | 'type' | 'phone' | 'area' | 'agent' | 'active';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}) {
  await delay(140);
  const search = normalizeSearch(params.search);
  const filtered = mockCreditors.filter((item) => {
    if (!search) {
      return true;
    }
    return `${item.code} ${item.companyName} ${item.currency} ${item.area} ${item.agent}`.toLowerCase().includes(search);
  });

  const sorted = [...filtered].sort((left, right) => {
    const order = params.sortOrder ?? 'asc';
    const key = params.sortBy ?? 'companyName';
    return compareValues(String(left[key]), String(right[key]), order);
  });

  return paginate(sorted, params.page, params.pageSize);
}

export async function getMockStockList(params: {
  page: number;
  pageSize: number;
  sortBy?: 'itemCode' | 'description' | 'group' | 'type' | 'baseUom' | 'control' | 'active';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}) {
  await delay(140);
  const search = normalizeSearch(params.search);
  const filtered = mockStock.filter((item) => {
    if (!search) {
      return true;
    }
    return `${item.itemCode} ${item.description} ${item.group} ${item.baseUom}`.toLowerCase().includes(search);
  });

  const sorted = [...filtered].sort((left, right) => {
    const order = params.sortOrder ?? 'asc';
    switch (params.sortBy) {
      case 'itemCode':
        return compareValues(left.itemCode, right.itemCode, order);
      case 'description':
        return compareValues(left.description, right.description, order);
      case 'group':
        return compareValues(left.group, right.group, order);
      case 'type':
        return compareValues(left.type, right.type, order);
      case 'baseUom':
        return compareValues(left.baseUom, right.baseUom, order);
      case 'control':
        return compareValues(left.control, right.control, order);
      case 'active':
        return compareValues(left.active, right.active, order);
      default:
        return compareValues(left.description, right.description, order);
    }
  });

  return paginate(sorted, params.page, params.pageSize);
}

export async function getMockCreditorOptions(params?: { search?: string; page?: number; pageSize?: number }) {
  const list = await getMockCreditorList({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
    sortBy: 'companyName',
    sortOrder: 'asc',
    search: params?.search,
  });
  return {
    ...list,
    items: list.items.map((item) => ({
      accNo: item.code,
      companyName: item.companyName,
      currency: item.currency,
    })),
  };
}

export async function getMockAgentOptions(params?: { search?: string; page?: number; pageSize?: number }) {
  await delay(110);
  const search = normalizeSearch(params?.search);
  const filtered = mockAgents.filter((item) => {
    if (!search) {
      return true;
    }
    return `${item.code} ${item.description}`.toLowerCase().includes(search);
  });
  return paginate(filtered, params?.page ?? 1, params?.pageSize ?? 20);
}

export async function getMockStockOptions(params?: { search?: string; page?: number; pageSize?: number }) {
  const list = await getMockStockList({
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 20,
    sortBy: 'description',
    sortOrder: 'asc',
    search: params?.search,
  });
  return {
    ...list,
    items: list.items.map((item) => ({
      itemCode: item.itemCode,
      description: item.description,
      group: item.group,
    })),
  };
}

export async function createMockPreviewTask(file: File) {
  await delay(180);
  const taskId = randomId('preview');
  const nextTask: PreviewTask = {
    taskId,
    createdAt: Date.now(),
    canceled: false,
    result: createPreviewResult(taskId, file),
  };
  savePreviewTasks({
    ...getPreviewTasks(),
    [taskId]: nextTask,
  });
  return {
    taskId,
    status: 'queued' as const,
  };
}

export async function getMockPreviewTask(taskId: string) {
  await delay(120);
  const task = getPreviewTasks()[taskId];
  if (!task) {
    throw new Error('Preview task not found.');
  }
  const status = resolvePreviewStatus(task);
  return {
    taskId,
    status,
    externalLink: task.result.payload.externalLink,
    file: task.result.file,
    result: status === 'succeeded' ? task.result : undefined,
    error: status === 'failed' ? 'Preview failed.' : undefined,
  };
}

export async function cancelMockPreviewTask(taskId: string) {
  await delay(100);
  const tasks = getPreviewTasks();
  const task = tasks[taskId];
  if (!task) {
    return false;
  }
  task.canceled = true;
  savePreviewTasks({
    ...tasks,
    [taskId]: task,
  });
  return true;
}

export async function reanalyzeMockPreviewTask(taskId: string) {
  await delay(180);
  const tasks = getPreviewTasks();
  const task = tasks[taskId];
  if (!task) {
    throw new Error('Preview task not found.');
  }
  task.createdAt = Date.now();
  task.canceled = false;
  task.result = {
    ...task.result,
    warnings: [],
    provider: 'mock-ai-reanalyze',
  };
  savePreviewTasks({
    ...tasks,
    [taskId]: task,
  });
  return getMockPreviewTask(taskId);
}

export async function createMockSubmitTask(request: {
  requestId: string;
  previewTaskId: string;
  payload: {
    supplierInvoiceNo: string;
    creditorCode: string;
    purchaseAgent: string;
    currencyCode: string;
    docDate: string;
    details: Array<{ amount: number | string }>;
  };
  createMissing?: {
    items?: Array<{
      line: number;
      enabled: boolean;
      payload: { itemCode: string; description: string; itemGroup: string };
    }>;
  };
}) {
  await delay(160);
  const taskId = randomId('submit');
  const result = buildSubmitResult(request);
  saveSubmitTasks({
    ...getSubmitTasks(),
    [taskId]: {
      taskId,
      requestId: request.requestId,
      previewTaskId: request.previewTaskId,
      createdAt: Date.now(),
      completed: false,
      result,
    },
  });
  return {
    success: true,
    taskId,
    requestId: request.requestId,
    previewTaskId: request.previewTaskId,
    status: 'queued' as const,
    message: 'Mock submit accepted.',
  };
}

export async function getMockSubmitTask(taskId: string) {
  await delay(120);
  const task = getSubmitTasks()[taskId];
  if (!task) {
    throw new Error('Submit task not found.');
  }
  const status = resolveSubmitStatus(task);
  return {
    taskId,
    requestId: task.requestId,
    previewTaskId: task.previewTaskId,
    status,
    message: status === 'succeeded' ? 'Mock submit completed.' : 'Mock submit running.',
    result: status === 'succeeded' ? task.result : undefined,
    error: status === 'failed' ? 'Mock submit failed.' : undefined,
  };
}
