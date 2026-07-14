-- CreateEnum
CREATE TYPE "RestaurantFormat" AS ENUM ('CITY', 'PARK', 'AIRPORT', 'APART_HOTEL');

-- CreateEnum
CREATE TYPE "RestaurantArea" AS ENUM ('CITY', 'PARK', 'AIRPORT');

-- CreateEnum
CREATE TYPE "MarketingBadge" AS ENUM ('NEW', 'HIT', 'SEASONAL', 'SPECIAL');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "format" "RestaurantFormat" NOT NULL,
    "area" "RestaurantArea" NOT NULL,
    "is_at_apart_hotel" BOOLEAN NOT NULL DEFAULT false,
    "city" VARCHAR(100) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "description" TEXT,
    "cover_image_url" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "yandex_maps_url" TEXT,
    "two_gis_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_opening_hours" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "restaurant_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "opens_at" VARCHAR(5),
    "closes_at" VARCHAR(5),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "restaurant_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_schedule_exceptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "restaurant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "label" VARCHAR(180) NOT NULL,
    "opens_at" VARCHAR(5),
    "closes_at" VARCHAR(5),
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "restaurant_schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menus" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "restaurant_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,

    CONSTRAINT "restaurant_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "menu_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "category_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "ingredients" TEXT,
    "weight_grams" INTEGER,
    "price_kopecks" INTEGER NOT NULL,
    "calories" INTEGER,
    "proteins" DECIMAL(6,2),
    "fats" DECIMAL(6,2),
    "carbohydrates" DECIMAL(6,2),
    "is_vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "is_spicy" BOOLEAN NOT NULL DEFAULT false,
    "is_lactose_free" BOOLEAN NOT NULL DEFAULT false,
    "is_gluten_free" BOOLEAN NOT NULL DEFAULT false,
    "is_light" BOOLEAN NOT NULL DEFAULT false,
    "marketing_badge" "MarketingBadge",
    "image_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergens" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_allergens" (
    "menu_item_id" UUID NOT NULL,
    "allergen_id" UUID NOT NULL,

    CONSTRAINT "menu_item_allergens_pkey" PRIMARY KEY ("menu_item_id","allergen_id")
);

-- CreateTable
CREATE TABLE "menu_item_overrides" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "restaurant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "description" TEXT,
    "ingredients" TEXT,
    "weight_grams" INTEGER,
    "price_kopecks" INTEGER,

    CONSTRAINT "menu_item_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE INDEX "restaurants_format_idx" ON "restaurants"("format");

-- CreateIndex
CREATE INDEX "restaurants_area_idx" ON "restaurants"("area");

-- CreateIndex
CREATE INDEX "restaurants_city_idx" ON "restaurants"("city");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_opening_hours_restaurant_id_day_of_week_key" ON "restaurant_opening_hours"("restaurant_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_schedule_exceptions_restaurant_id_date_key" ON "restaurant_schedule_exceptions"("restaurant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "menus_slug_key" ON "menus"("slug");

-- CreateIndex
CREATE INDEX "restaurant_menus_menu_id_idx" ON "restaurant_menus"("menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_menus_restaurant_id_menu_id_key" ON "restaurant_menus"("restaurant_id", "menu_id");

-- CreateIndex
CREATE INDEX "menu_categories_menu_id_position_idx" ON "menu_categories"("menu_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_menu_id_slug_key" ON "menu_categories"("menu_id", "slug");

-- CreateIndex
CREATE INDEX "menu_items_category_id_position_idx" ON "menu_items"("category_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_category_id_slug_key" ON "menu_items"("category_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_slug_key" ON "allergens"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_name_key" ON "allergens"("name");

-- CreateIndex
CREATE INDEX "menu_item_allergens_allergen_id_idx" ON "menu_item_allergens"("allergen_id");

-- CreateIndex
CREATE INDEX "menu_item_overrides_menu_item_id_idx" ON "menu_item_overrides"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_overrides_restaurant_id_menu_item_id_key" ON "menu_item_overrides"("restaurant_id", "menu_item_id");

-- AddForeignKey
ALTER TABLE "restaurant_opening_hours" ADD CONSTRAINT "restaurant_opening_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_schedule_exceptions" ADD CONSTRAINT "restaurant_schedule_exceptions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_menus" ADD CONSTRAINT "restaurant_menus_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_menus" ADD CONSTRAINT "restaurant_menus_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_allergens" ADD CONSTRAINT "menu_item_allergens_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_allergens" ADD CONSTRAINT "menu_item_allergens_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "allergens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_overrides" ADD CONSTRAINT "menu_item_overrides_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_overrides" ADD CONSTRAINT "menu_item_overrides_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
