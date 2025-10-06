package org.santayn.reservation.models.classroom;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

@Entity
@Table(name = "room_faculty", uniqueConstraints = {
        @UniqueConstraint(name = "uq_room_faculty_pair", columnNames = {"room_id", "faculty_id"})
}, indexes = {
        @Index(name = "ix_room_faculty_room", columnList = "room_id"),
        @Index(name = "ix_room_faculty_faculty", columnList = "faculty_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomFaculty {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements java.io.Serializable {
        @Column(name = "room_id")
        private Long roomId;
        @Column(name = "faculty_id")
        private Long facultyId;
    }

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("roomId")
    @JoinColumn(name = "room_id", nullable = false)
    private Classroom room;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("facultyId")
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;

    // Основной ли это факультет для зоны
    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    // Вес/приоритет для сортировки подсветки зон (0 по умолчанию)
    @Column(name = "weight", nullable = false)
    private int weight;
}
