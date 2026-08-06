-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'FOOTER_INQUIRY';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'CONTACT_REQUEST';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'RESERVATION_REQUEST';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'BANQUET_REQUEST';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'FRANCHISE_REQUEST';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'JOB_GENERAL_INQUIRY';
ALTER TYPE "OperationalNotificationEvent" ADD VALUE 'EVENT_REGISTRATION';
