package org.santayn.reservation.models.classroom;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.specialization.Specialization;

import java.io.Serializable;

@Entity
@Table(name = "classroom_specialization")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClassroomSpecialization {

    @EmbeddedId
    private Id id;

    @MapsId("classroomId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @MapsId("specializationId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialization_id")
    private Specialization specialization;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class Id implements Serializable {
        private Long classroomId;
        private Long specializationId;
    }
}
