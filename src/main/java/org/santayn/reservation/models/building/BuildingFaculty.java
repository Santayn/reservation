package org.santayn.reservation.models.building;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

@Entity
@Table(name = "building_faculty")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuildingFaculty {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements java.io.Serializable {
        @Column(name = "building_id")
        private Long buildingId;
        @Column(name = "faculty_id")
        private Long facultyId;
    }

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("buildingId")
    @JoinColumn(name = "building_id", nullable = false)
    private Building building;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("facultyId")
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;
}
