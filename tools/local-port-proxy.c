#include <arpa/inet.h>
#include <errno.h>
#include <grp.h>
#include <netinet/in.h>
#include <poll.h>
#include <pwd.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#define BUFFER_SIZE 65536

static int write_all(int descriptor, const char *buffer, ssize_t length) {
  ssize_t offset = 0;
  while (offset < length) {
    ssize_t written = write(descriptor, buffer + offset, (size_t)(length - offset));
    if (written > 0) {
      offset += written;
      continue;
    }
    if (written < 0 && errno == EINTR) continue;
    return -1;
  }
  return 0;
}

static void proxy_connection(int client, int target_port) {
  int upstream = socket(AF_INET, SOCK_STREAM, 0);
  if (upstream < 0) _exit(1);

  struct sockaddr_in target = {
      .sin_family = AF_INET,
      .sin_port = htons((uint16_t)target_port),
      .sin_addr.s_addr = htonl(INADDR_LOOPBACK),
  };
  if (connect(upstream, (struct sockaddr *)&target, sizeof(target)) != 0) {
    close(upstream);
    _exit(1);
  }

  struct pollfd descriptors[2] = {
      {.fd = client, .events = POLLIN},
      {.fd = upstream, .events = POLLIN},
  };
  char buffer[BUFFER_SIZE];

  while (descriptors[0].fd >= 0 || descriptors[1].fd >= 0) {
    int ready = poll(descriptors, 2, -1);
    if (ready < 0) {
      if (errno == EINTR) continue;
      break;
    }

    for (int index = 0; index < 2; index += 1) {
      if (descriptors[index].fd < 0) continue;
      if ((descriptors[index].revents & (POLLIN | POLLHUP | POLLERR)) == 0) continue;

      int source = descriptors[index].fd;
      int destination = descriptors[1 - index].fd;
      ssize_t count = read(source, buffer, sizeof(buffer));
      if (count > 0 && destination >= 0) {
        if (write_all(destination, buffer, count) != 0) goto done;
        continue;
      }

      close(source);
      descriptors[index].fd = -1;
      if (destination >= 0) shutdown(destination, SHUT_WR);
    }
  }

done:
  if (descriptors[0].fd >= 0) close(descriptors[0].fd);
  if (descriptors[1].fd >= 0) close(descriptors[1].fd);
  _exit(0);
}

int main(int argc, char **argv) {
  int target_port = argc > 1 ? atoi(argv[1]) : 7489;
  int listen_port = argc > 2 ? atoi(argv[2]) : 80;
  if (target_port < 1 || target_port > 65535 || listen_port < 1 || listen_port > 65535) {
    fprintf(stderr, "invalid port\n");
    return 2;
  }

  int listener = socket(AF_INET, SOCK_STREAM, 0);
  if (listener < 0) {
    perror("socket");
    return 1;
  }
  int reuse = 1;
  if (setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) != 0) {
    perror("setsockopt");
    return 1;
  }

  struct sockaddr_in address = {
      .sin_family = AF_INET,
      .sin_port = htons((uint16_t)listen_port),
      .sin_addr.s_addr = htonl(INADDR_LOOPBACK),
  };
  if (bind(listener, (struct sockaddr *)&address, sizeof(address)) != 0) {
    perror("bind loopback");
    return 1;
  }
  if (listen(listener, 128) != 0) {
    perror("listen");
    return 1;
  }

  if (geteuid() == 0) {
    struct passwd *nobody = getpwnam("nobody");
    if (nobody == NULL || initgroups(nobody->pw_name, nobody->pw_gid) != 0 ||
        setgid(nobody->pw_gid) != 0 || setuid(nobody->pw_uid) != 0) {
      perror("drop privileges");
      return 1;
    }
  }

  signal(SIGCHLD, SIG_IGN);
  signal(SIGPIPE, SIG_IGN);

  for (;;) {
    int client = accept(listener, NULL, NULL);
    if (client < 0) {
      if (errno == EINTR) continue;
      perror("accept");
      return 1;
    }
    pid_t child = fork();
    if (child == 0) {
      close(listener);
      proxy_connection(client, target_port);
    }
    if (child < 0) perror("fork");
    close(client);
  }
}
