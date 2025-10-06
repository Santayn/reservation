package org.santayn.reservation.models.group;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.user.User;

@Entity
@Table(name = "group_teachers", uniqueConstraints = {
        @UniqueConstraint(name = "uq_group_teacher", columnNames = {"group_id", "teacher_user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupTeacher {

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements java.io.Serializable {
        @Column(name = "group_id")
        private Long groupId;
        @Column(name = "teacher_user_id")
        private Long teacherUserId;
    }

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("groupId")
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("teacherUserId")
    @JoinColumn(name = "teacher_user_id", nullable = false)
    private User teacher;

    // Роль преподавателя в контексте группы (например: "teacher", "curator")
    @Column(name = "role", nullable = false, length = 64)
    private String role;
}
