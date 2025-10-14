package org.santayn.reservation.models.booking;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.schedule_slot.ScheduleSlot;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "bookings",
        indexes = @Index(name = "ix_bookings_slot", columnList = "slot_id"),
        uniqueConstraints = @UniqueConstraint(name = "ux_bookings_slot_unique", columnNames = "slot_id")
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    public enum Status { PENDING, APPROVED, REJECTED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Слот (аудитория + время)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "slot_id", nullable = false)
    private ScheduleSlot slot;

    // Статус заявки
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    // Когда создано
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // Комментарий (опционально)
    @Column(name = "comment", length = 1000)
    private String comment;
}
