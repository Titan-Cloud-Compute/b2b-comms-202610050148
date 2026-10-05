import { FIRM_NAV_ITEMS, NavItem } from './nav-items';

export type NavGroupLabel = 'Main' | 'Vendor' | 'Customer' | 'Admin';

export interface NavGroup {
  label: NavGroupLabel;
  items: NavItem[];
  /** Whole group is only shown to admin roles. */
  adminOnly?: boolean;
}

/** Which sidebar group each story page belongs to (styling card). */
const GROUP_BY_PATH: Record<string, NavGroupLabel> = {
  '/vendor/profile': 'Vendor',
  '/channels': 'Vendor',
  '/invoices': 'Vendor',
  '/settings/notifications': 'Vendor',
  '/orders': 'Customer',
  '/admin/customers': 'Admin',
  '/admin/audit-log': 'Admin',
};

const ORDER: NavGroupLabel[] = ['Main', 'Vendor', 'Customer', 'Admin'];

function buildGroups(items: NavItem[]): NavGroup[] {
  return ORDER.map(label => ({
    label,
    adminOnly: label === 'Admin',
    items: items
      .filter(i => (GROUP_BY_PATH[i.path] ?? 'Main') === label)
      .map(i => (label === 'Admin' ? { ...i, adminOnly: true } : i)),
  })).filter(g => g.items.length > 0);
}

/** Grouped sidebar navigation: Main (Dashboard), Vendor, Customer, Admin. */
export const NAV_GROUPS: NavGroup[] = buildGroups(FIRM_NAV_ITEMS);
