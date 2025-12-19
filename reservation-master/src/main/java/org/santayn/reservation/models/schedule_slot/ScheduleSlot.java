package org.santayn.reservation.models.schedule_slot;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.classroom.Classroom;

import java.time.LocalDateTime;

@Entity
@Table(name = "schedule_slots", indexes = {
        @Index(name = "ix_slots_room_start", columnList = "classroom_id,start_at")
})
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleSlot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Какой кабинет
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    // Когда начинается и заканчивается слот
    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;
}
