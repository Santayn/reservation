package org.santayn.reservation.models.classroom;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

import java.io.Serializable;

@Entity
@Table(name = "classroom_faculty")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClassroomFaculty {

    @EmbeddedId
    private Id id;

    @MapsId("classroomId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @MapsId("facultyId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor
    public static class Id implements Serializable {
        private Long classroomId;
        private Long facultyId;
    }
}
