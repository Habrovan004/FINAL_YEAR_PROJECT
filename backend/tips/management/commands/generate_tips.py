from django.core.management.base import BaseCommand
from tips.models import Tip, TipCategory
from tips.ai_service import generate_maternal_tip
from django.db import transaction

class Command(BaseCommand):
    help = 'Generates new AI-powered maternal health tips for all categories and trimesters.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting AI tip generation...'))

        categories = TipCategory.objects.all()
        trimesters = ['1', '2', '3'] # Assuming these are the relevant trimesters
        tip_type = 'tip' # Default tip type for AI generated content

        if not categories.exists():
            self.stdout.write(self.style.WARNING('No tip categories found. Please create some categories first.'))
            return

        generated_count = 0
        for category in categories:
            for trimester in trimesters:
                try:
                    with transaction.atomic():
                        # Check if a tip for this category and trimester already exists and is not reviewed
                        # This prevents generating duplicates for content that is awaiting review
                        existing_tip = Tip.objects.filter(
                            category=category,
                            trimester=trimester,
                            is_ai_generated=True,
                            is_reviewed=False
                        ).first()

                        if existing_tip:
                            self.stdout.write(self.style.NOTICE(f'Skipping generation for {category.name} - Trimester {trimester}: Unreviewed AI tip already exists.'))
                            continue

                        ai_data = generate_maternal_tip(category.name, trimester)
                        
                        Tip.objects.create(
                            category=category,
                            title=ai_data['title'],
                            description=ai_data['description'],
                            title_sw=ai_data['title_sw'],
                            description_sw=ai_data['description_sw'],
                            trimester=trimester,
                            tip_type=tip_type,
                            is_ai_generated=True,
                            is_reviewed=False, # Always requires human review
                            is_daily=False # AI generated tips are not daily by default
                        )
                        generated_count += 1
                        self.stdout.write(self.style.SUCCESS(f'Generated tip for {category.name} - Trimester {trimester}'))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error generating tip for {category.name} - Trimester {trimester}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Finished AI tip generation. Total new tips generated: {generated_count}'))
