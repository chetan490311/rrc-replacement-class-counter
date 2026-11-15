# RRC – Replacement Class Counter (starter project)

This is the revised RRC source project for your private GitHub repository.

## Included in this build
- Teacher registration (initials, full name, subject)
- Excel workbook import for Monday–Friday worksheets
- Parser for the supplied routine layout: section labels in column A; periods in columns B–J
- Editable section labels and timetable cells
- Teacher-wise section matching from initials in timetable cells
- Replacement entry by date, weekday, section/lab
- Lab entry supports 1 or 2 replacement periods
- Local persistent storage through Capacitor Preferences
- Teacher summary, date filtering, print stylesheet
- JSON backup and restore
- GitHub Actions workflow to build a debug APK

## Important limitations in this starter
1. Nepali BS date conversion is not yet integrated. The app currently accepts a BS date as text and uses an AD date to determine the weekday. Do not use it as a final official record system until BS calendar conversion is added and tested.
2. The importer is designed around the uploaded sample's visible structure. It reads cell values in columns A:J and looks for section labels such as XI M1 / XII M1. Merged cells and unusual formatting should be reviewed manually after import.
3. Lab subject eligibility is inferred from the teacher's subject and routine entries; verify lab assignments in the editor before use.
4. The report currently prints through the browser/Android print dialog. Dedicated A4 PNG export and detailed month selection are planned next.
5. No paid AI API is used. Routine extraction is deterministic, with manual review.

## GitHub upload instructions (no command line)
1. Download and extract the ZIP.
2. Open your GitHub repository `rrc-replacement-class-counter`.
3. Click **Add file** → **Upload files**.
4. Open the extracted project folder and upload its contents (including `.github`).
5. Commit directly to `main` with message `Add revised RRC application source`.

## APK build
After uploading, open the repository's **Actions** tab. Enable Actions if prompted. Choose **Build RRC Android APK** → **Run workflow**. Wait for the workflow to complete successfully. Open the completed run and download the `RRC-debug-apk` artifact. Extract the artifact ZIP to get `app-debug.apk`.

## Technical note
This project uses Vite, Capacitor 7, SheetJS (`xlsx`) and Capacitor Preferences. GitHub Actions installs dependencies and generates the Android project in the cloud, so Android Studio is not required on the old laptop.
