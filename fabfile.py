import sys
import os
import deploy_config

# Add current directory to path.
local_dir = os.path.dirname(__file__)
sys.path.append(local_dir)

from fabric.api import *

path = '/home/crisisnet/sucka'
release_file = '/home/crisisnet/releases.sucka'

@task
def staging():
    env.host_string = deploy_config.STAGING_HOST
    env.user = deploy_config.STAGING_USER
    env.password = deploy_config.STAGING_PASSWORD
    env.key_filename = ''
    env.branch = 'development'
    env.upstart_script = 'sucka.conf'
    env.settings_file = 'staging.json'


@task
def production():
    env.host_string = ''
    env.user = ''
    env.key_filename = ''
    env.branch = 'master'
    env.upstart_script = ''
    env.settings_file = 'production.json'


@task
def add_apt_repo():
    """
    Adds nodejs PPA.
    This is needed only the first time a new instance is configure.
    """
    sudo('apt-get install python-software-properties')
    sudo('add-apt-repository ppa:chris-lea/node.js')
    sudo('apt-get update')



def install_deps():
    """
    Installs os and base packages.
    """
    deps = ['python-software-properties python g++ make nodejs git']
    for dep in deps:
        sudo('apt-get install -y --no-upgrade %s' % dep)


def check_upstart(upstart_conf):
    """
    Checks if upstart exists; if not, upstart job is created.
    If it exists and is different from the checked-in version, it's updated.
    """
    sudo('test -f /etc/init/sucka.conf || cp etc/%s /etc/init/sucka.conf' % upstart_conf)
    sudo('diff etc/%s /etc/init/sucka.conf || cp etc/%s /etc/init/sucka.conf' % (upstart_conf, upstart_conf))


def prepare_log_file():
    """
    Creates logfile and changes permissions so that user `cn` can write to it.
    """
    sudo('test -f /var/log/sucka.log || touch /var/log/sucka.log')
    #sudo('chown cn:cn /var/log/sucka.log')


@task
@parallel
def deploy(branch=None):
    """
    SSH to ec2, updates git code, restarts app server.
    """
    branch = branch or env.branch
    install_deps()
    prepare_log_file()

    # Check for first deploy.
    run("test -d %s || git clone https://github.com/ushahidi/sucka.git %s" % (path, path))
    with cd(path):
        #run('git branch --set-upstream %s origin/%s' % (branch, branch))

        run('git fetch')
        run('git checkout %s && git pull' % branch)

        do_release()
        record_release()


def copy_private_files():
    """
    Files that we shouldn't include in the public repo because they contain 
    sensitive information (third-party service API keys, db connect info, etc)
    """
    settings_file = '/config/' + env.settings_file
    put(local_dir + settings_file,path + settings_file,mirror_local_mode=True)


def do_release():
    sudo('npm install')
    copy_private_files()
    check_upstart(env.upstart_script)
    sudo('service sucka status && restart sucka || start sucka')


def record_release():
    """
    Records the git commit version so that we can rollback.
    """
    current_release = run("git rev-parse HEAD")
    # Note that this uses warn_only kwarg which will still fail in older 
    # versions of fabric.
    last_release = run("tail -n 1 %s" % release_file, warn_only=True)
    if last_release.failed:
        run("echo %s > %s" % (current_release, release_file))
    elif current_release != last_release:
        run("echo %s >> %s" % (current_release, release_file))


@task
@parallel
def rollback(num=1):
    """
    Rollsback git version to a previous release.
    """
    num = num + 1
    with cd(path):
        release_version = run("tail -n %s %s | head -n 1" % (num, release_file))
        run('git checkout %s' % release_version)
        do_release()
