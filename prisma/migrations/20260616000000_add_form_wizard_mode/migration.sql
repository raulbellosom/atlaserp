-- Add wizard_mode to website_form
ALTER TABLE "website_form" ADD COLUMN "wizard_mode" BOOLEAN NOT NULL DEFAULT false;

-- Add step_number and step_title to website_form_field
ALTER TABLE "website_form_field" ADD COLUMN "step_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "website_form_field" ADD COLUMN "step_title" TEXT;
