package org.santayn.reservation.models.specialization;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.classroom.Classroom;

@Entity
@Table(name = "specialization_room", uniqueConstraints = {
        @UniqueConstraint(name = "uq_spec_room", columnNames = {"specialization_id", "room_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpecializationRoom {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements java.io.Serializable {
        @Column(name = "specialization_id")
        private Long specializationId;
        @Column(name = "room_id")
        private Long roomId;
    }

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("specializationId")
    @JoinColumn(name = "specialization_id", nullable = false)
    private Specialization specialization;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("roomId")
    @JoinColumn(name = "room_id", nullable = false)
    private Classroom room;
}
