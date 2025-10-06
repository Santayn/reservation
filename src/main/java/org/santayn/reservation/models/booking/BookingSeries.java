package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.user.User;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking_series")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSeries {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Кто создал серию
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    // Правило повторов (iCal RRULE, например: FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=...)
    @Column(name = "rrule", nullable = false, length = 1024)
    private String rrule;

    // Старт серии (UTC)
    @Column(name = "dtstart", nullable = false)
    private OffsetDateTime dtstart;

    // Окончание серии (опционально)
    @Column(name = "until_at")
    private OffsetDateTime untilAt;

    // Таймзона серии (для справки)
    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "UTC";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
