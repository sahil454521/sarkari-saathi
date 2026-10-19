import type { Profile } from "./profile.ts";

// Synthetic demo personas (spec §2). Not real people.
export const sunita: Profile = { age: 45, gender: "female", state: "Maharashtra", occupation: "farmer", ownsFarmland: true,
  annualFamilyIncome: 90000, paysIncomeTax: false, rationCard: "yellow", hasLpgConnection: true, isPregnant: false, daughterAges: [2] };
export const ramesh: Profile = { age: 34, gender: "male", state: "Maharashtra", occupation: "street_vendor", ownsFarmland: false,
  annualFamilyIncome: 120000, paysIncomeTax: false, rationCard: "orange", hasLpgConnection: true, daughterAges: [] };
export const kamla: Profile = { age: 72, gender: "female", state: "Maharashtra", occupation: "homemaker",
  annualFamilyIncome: 60000, paysIncomeTax: false, rationCard: "yellow", hasLpgConnection: false, daughterAges: [45] };
