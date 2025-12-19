// org/santayn/reservation/models/user/Teacher_Group.java
package org.santayn.reservation.models.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "teacher_group",
        uniqueConstraints = @UniqueConstraint(
                name = "ux_teacher_group",
                columnNames = {"teacher_id", "group_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Teacher_Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // User.id (Long)
    @Column(name = "teacher_id", nullable = false)
    private Long teacherId;

    // Group.id (Integer)
    @Column(name = "group_id", nullable = false)
    private Integer groupId;
}
