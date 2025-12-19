package org.santayn.reservation.service;// src/main/java/org/santayn/reservation/jobs/BookingCleanupJob.java


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.santayn.reservation.service.BookingService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingCleanupJob {

    private final BookingService bookingService;

    /** Каждую минуту удаляем записи с expires_at < NOW(). */
    @Transactional
    @Scheduled(fixedDelay = 60_000L, initialDelay = 30_000L)
    public void cleanup() {
        int deleted = bookingService.cleanupExpired();
        if (deleted > 0) {
            log.info("BookingCleanupJob: deleted {} expired bookings", deleted);
        }
    }
}
