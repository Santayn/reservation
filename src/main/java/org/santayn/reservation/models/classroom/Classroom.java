// src/main/java/org/santayn/reservation/models/classroom/Classroom.java
package org.santayn.reservation.models.classroom;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.building.Building;

@Entity
@Table(
        name = "classrooms",
        uniqueConstraints = @UniqueConstraint(name = "uq_classroom_building_name", columnNames = {"building_id", "name"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Classroom {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** "Ауд. 102" и т.п. */
    @Column(nullable = false, length = 128)
    private String name;

    /** Вместимость. */
    @Column(nullable = false)
    private Integer capacity;

    /** Корпус (опционально). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id")
    private Building building;
}
