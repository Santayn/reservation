// org/santayn/reservation/models/user/User.java
package org.santayn.reservation.models.user;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "ux_users_login", columnList = "login", unique = true)
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Логин (уникальный)
    @Column(name = "login", nullable = false, length = 100, unique = true)
    private String login;

    // ФИО
    @Column(name = "full_name", length = 255)
    private String fullName;

    // Пароль (hash)
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    // Роль
    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    // Факультет (связь)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id", nullable = false)
    private Faculty faculty;
}
