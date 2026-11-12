import type { Lang } from '@wehdathub/shared';

/** Unit features as the server stores them (key), with the Arabic and English label and the group each belongs to. */
const FEATURES: Record<string, [string, string, string]> = {
  north_facing: ["بحري", "North facing", "orientation"],
  south_facing: ["قبلي", "South facing", "orientation"],
  east_facing: ["شرقي", "East facing", "orientation"],
  west_facing: ["غربي", "West facing", "orientation"],
  corner: ["ناصية", "Corner unit", "orientation"],
  master_bedroom: ["غرفة ماستر", "Master bedroom", "layout"],
  dressing_room: ["دريسنج", "Dressing room", "layout"],
  nanny_room: ["غرفة مربية", "Nanny room", "layout"],
  driver_room: ["غرفة سائق", "Driver room", "layout"],
  laundry_room: ["غرفة غسيل", "Laundry room", "layout"],
  storage_room: ["مخزن", "Storage room", "layout"],
  basement: ["بدروم", "Basement", "layout"],
  duplex_layout: ["دورين", "Two levels", "layout"],
  roof: ["روف", "Roof", "outdoor"],
  private_garden: ["جنينة خاصة", "Private garden", "outdoor"],
  terrace: ["تراس", "Terrace", "outdoor"],
  balcony: ["بلكونة", "Balcony", "outdoor"],
  private_pool: ["حمام سباحة خاص", "Private pool", "outdoor"],
  view_garden: ["فيو جاردن", "Garden view", "view"],
  view_pool: ["فيو بول", "Pool view", "view"],
  view_lagoon: ["فيو لاجون", "Lagoon view", "view"],
  view_landscape: ["فيو لاندسكيب", "Landscape view", "view"],
  view_club: ["فيو النادي", "Club view", "view"],
  view_sea: ["فيو بحر", "Sea view", "view"],
  view_open: ["فيو مفتوح", "Open view", "view"],
  view_street: ["على الشارع", "Street view", "view"],
  furnished: ["مفروشة", "Furnished", "equipment"],
  kitchen_installed: ["مطبخ مركب", "Fitted kitchen", "equipment"],
  appliances: ["بالأجهزة", "With appliances", "equipment"],
  ac_installed: ["تكييفات", "ACs installed", "equipment"],
  smart_home: ["سمارت هوم", "Smart home", "equipment"],
  natural_gas: ["عداد غاز", "Natural gas", "equipment"],
  elevator: ["أسانسير", "Elevator", "building"],
  parking: ["جراج", "Parking", "building"],
  club_membership: ["عضوية النادي", "Club membership", "building"],
  security: ["أمن 24 ساعة", "24/7 security", "building"],
};

const GROUP_ICON: Record<string, string> = { orientation: '🧭', layout: '🛏', outdoor: '🌿', view: '🌅', equipment: '🛠', building: '🏢' };

/** A feature key as a chip: an icon for its group and the label in the app language. Unknown keys read as plain words. */
export function featureChip(key: string, lang: Lang): { key: string; icon: string; label: string } {
  const f = FEATURES[key];
  if (!f) return { key, icon: '•', label: key.replace(/_/g, ' ') };
  return { key, icon: GROUP_ICON[f[2]] ?? '•', label: lang === 'ar' ? f[0] : f[1] };
}
