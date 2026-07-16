import { BurgerDrawer } from "@/components/BurgerDrawer";
import { sampleCategories, sampleSettings } from "../support/sample-data";

export function Default() {
  return <BurgerDrawer open onClose={() => {}} categories={sampleCategories} settings={sampleSettings} />;
}

export function NoContacts() {
  return <BurgerDrawer open onClose={() => {}} categories={sampleCategories} settings={null} />;
}
