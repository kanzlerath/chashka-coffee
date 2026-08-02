-- CreateEnum
CREATE TYPE "MenuItemMeasurementUnit" AS ENUM ('GRAM', 'MILLILITER', 'PIECE');

-- AlterTable
ALTER TABLE "menu_item_overrides" ADD COLUMN     "measurement_unit" "MenuItemMeasurementUnit";

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "measurement_unit" "MenuItemMeasurementUnit" NOT NULL DEFAULT 'GRAM';
