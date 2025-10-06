package org.santayn.reservation.models.group;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "groups", uniqueConstraints = {
        @UniqueConstraint(name = "uq_group_name", columnNames = {"name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Удобочитаемое имя/код группы
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    // Количество студентов в группе
    @Column(name = "persons_count", nullable = false)
    private Integer personsCount;
}
