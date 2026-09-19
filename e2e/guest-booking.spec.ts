import { test } from "@playwright/test";

test.describe("Guest Booking Flow", () => {
  test.skip("Guest booking UI is not yet implemented", () => {
    // ╔══════════════════════════════════════════════════════════════╗
    // ║  Guest booking tests are skipped because the current        ║
    // ║  system does not have public-facing guest booking pages.    ║
    // ║                                                            ║
    // ║  The system is a staff/admin dashboard only. All booking    ║
    // ║  operations are performed by front_desk/admin users from    ║
    // ║  within the dashboard at /[locale]/dashboard/reservations.  ║
    // ║                                                            ║
    // ║  When guest-facing booking UI is added, create tests for:   ║
    // ║  1. Homepage loads                                           ║
    // ║  2. Guest can search for available rooms                     ║
    // ║  3. Guest can filter by check-in/out dates + guests          ║
    // ║  4. Guest can open room details page                         ║
    // ║  5. Guest can start a booking                                ║
    // ║  6. Validation: missing required fields                      ║
    // ║  7. Validation: invalid dates                                ║
    // ║  8. Guest can complete a valid booking                       ║
    // ║  9. Guest sees booking confirmation                          ║
    // ║  10. Guest can view booking details                          ║
    // ║  11. Guest can cancel/modify booking                         ║
    // ╚══════════════════════════════════════════════════════════════╝
  });
});

test.describe("Staff / Housekeeping Flow", () => {
  test.skip("Staff/housekeeping UI is not yet implemented", () => {
    // Staff/housekeeping pages are not present in the current app.
    // The closest role is `front_desk` which operates within the
    // dashboard. When staff-specific pages are added, create tests for:
    // 1. Staff can log in
    // 2. Staff can view assigned rooms/tasks
    // 3. Staff can update room cleaning/status
    // 4. Staff cannot access admin-only pages
  });
});
