package org.santayn.reservation.models.teacher;
import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

@Entity
@Table(
        name = "teacher",
        indexes = {
                @Index(name = "ux_teacher_login", columnList = "login", unique = true)
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Teacher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ФИО
    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    // Логин (уникальный)
    @Column(name = "login", nullable = false, unique = true, length = 100)
    private String login;

    // Пароль (храним hash)
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    // Привязка к факультету
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;
}
