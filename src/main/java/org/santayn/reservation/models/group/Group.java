package org.santayn.reservation.models.group;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "app_group",
        indexes = @Index(name = "ux_app_group_name", columnList = "name", unique = true)
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Integer id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "course_code")
    private Integer courseCode;

    // ВНИМАНИЕ: никаких @OneToMany здесь.
    // Связи идут через booking_group и teacher_group по FK.
    /** Вместимость группы (сколько студентов в группе) */
    @Column(name = "capacity", nullable = false)
    @Builder.Default
    private Integer capacity = 0;
}
