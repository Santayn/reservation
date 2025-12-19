// org/santayn/reservation/security/CustomUserDetailsService.java
package org.santayn.reservation.security;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.user.User;
import org.santayn.reservation.repositories.UserRepository;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service("customUserDetailsService")
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepo;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // username = login
        User u = userRepo.findByLogin(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        var authorities = u.isAdmin()
                ? AuthorityUtils.createAuthorityList("ROLE_ADMIN", "ROLE_USER")
                : AuthorityUtils.createAuthorityList("ROLE_USER");

        return org.springframework.security.core.userdetails.User
                .withUsername(u.getLogin())       // логин вместо email
                .password(u.getPasswordHash())
                .authorities(authorities)
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(false)
                .build();
    }
}
