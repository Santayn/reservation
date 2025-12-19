package org.santayn.reservation.models.user;

import jakarta.persistence.*;
import lombok.*;
import org.santayn.reservation.models.faculty.Faculty;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "ix_users_faculty", columnList = "faculty_id"),
        @Index(name = "ix_users_login", columnList = "login")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uq_users_login", columnNames = {"login"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Логин (уникальный)
    @Column(name = "login", nullable = false, length = 128)
    private String login;

    // Пароль хранить ТОЛЬКО как хэш
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    // Админ?
    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    // Базовая принадлежность пользователя факультету (опционально)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;
}
