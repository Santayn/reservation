package org.santayn.reservation.models.user;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "ux_users_email", columnList = "email", unique = true)
})
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // до 320 символов по стандарту email
    @Column(name = "email", nullable = false, length = 320, unique = true)
    private String email;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "is_admin", nullable = false)
    private boolean admin;
}