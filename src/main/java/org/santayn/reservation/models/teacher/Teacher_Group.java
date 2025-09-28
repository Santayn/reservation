package org.santayn.reservation.models.teacher;

import jakarta.persistence.*;
import lombok.*;


@Entity
@Table(
        name = "teacher_group",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_teacher_group", columnNames = {"teacher_id", "group_id"})
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Teacher_Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ссылка на преподавателя
    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    // ссылка на группу
    @Column(name = "group_id", nullable = false)
    private Integer groupId;
}
